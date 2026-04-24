"""
Tortellino backend regression suite.
Covers: auth, lessons CRUD, progress (XP/level/streak), saved questions.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = "https://italian-learn-89.preview.emergentagent.com"
ADMIN_EMAIL = "lorenzopasqualot@gmail.com"
ADMIN_PASSWORD = "Tortellino2026!"


# --------------------------- shared state ---------------------------
state: dict = {}


def _post(path, **kw):
    return requests.post(f"{BASE_URL}{path}", timeout=30, **kw)


def _get(path, **kw):
    return requests.get(f"{BASE_URL}{path}", timeout=30, **kw)


def _put(path, **kw):
    return requests.put(f"{BASE_URL}{path}", timeout=30, **kw)


def _delete(path, **kw):
    return requests.delete(f"{BASE_URL}{path}", timeout=30, **kw)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# --------------------------- AUTH ---------------------------
class TestAuth:
    def test_health(self):
        r = _get("/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_admin_login(self):
        r = _post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == ADMIN_EMAIL
        state["admin_token"] = data["token"]
        state["admin_id"] = data["user"]["id"]

    def test_admin_login_wrong_password(self):
        r = _post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": "WRONG"})
        assert r.status_code == 401

    def test_register_admin_email_conflict(self):
        # admin already seeded -> expect 400
        r = _post(
            "/api/auth/register",
            json={"email": ADMIN_EMAIL, "password": "whatever123", "name": "X"},
        )
        assert r.status_code == 400

    def test_register_student(self):
        email = f"test_student_{uuid.uuid4().hex[:8]}@test.com"
        r = _post(
            "/api/auth/register",
            json={"email": email, "password": "student123", "name": "TEST Mario"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["role"] == "student"
        assert data["user"]["xp"] == 0
        assert data["user"]["level"] == 1
        state["student_token"] = data["token"]
        state["student_id"] = data["user"]["id"]
        state["student_email"] = email

    def test_me_with_token(self):
        r = _get("/api/auth/me", headers=_auth(state["student_token"]))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == state["student_email"]

    def test_me_without_token(self):
        r = _get("/api/auth/me")
        assert r.status_code == 401


# --------------------------- LESSONS ---------------------------
class TestLessons:
    def test_create_lesson_as_student_forbidden(self):
        r = _post(
            "/api/lessons",
            headers=_auth(state["student_token"]),
            json={"title": "X", "description": "x", "exercises": []},
        )
        assert r.status_code == 403

    def test_create_lesson_as_admin(self):
        payload = {
            "title": "TEST Lezione 1",
            "description": "Saluti base",
            "shuffle": False,
            "order": 999,
            "exercises": [
                {
                    "type": "multiple_choice",
                    "question": "Come si dice 'hello' in italiano?",
                    "options": ["Ciao", "Arrivederci", "Grazie", "Prego"],
                    "correct_index": 0,
                    "explanation": "Ciao = hello",
                },
                {
                    "type": "true_false",
                    "question": "'Grazie' significa 'thank you'?",
                    "correct_bool": True,
                },
                {
                    "type": "open_answer",
                    "question": "Traduci 'Goodbye' in italiano:",
                    "accepted_answers": ["Arrivederci", "ciao"],
                },
            ],
        }
        r = _post("/api/lessons", headers=_auth(state["admin_token"]), json=payload)
        assert r.status_code == 200, r.text
        lesson = r.json()["lesson"]
        assert lesson["title"] == "TEST Lezione 1"
        assert len(lesson["exercises"]) == 3
        assert all("id" in e for e in lesson["exercises"])
        state["lesson_id"] = lesson["id"]
        state["exercises"] = lesson["exercises"]

    def test_list_lessons(self):
        r = _get("/api/lessons", headers=_auth(state["student_token"]))
        assert r.status_code == 200
        lessons = r.json()["lessons"]
        found = next((l for l in lessons if l["id"] == state["lesson_id"]), None)
        assert found is not None
        assert found["exercise_count"] == 3

    def test_get_lesson(self):
        r = _get(f"/api/lessons/{state['lesson_id']}", headers=_auth(state["student_token"]))
        assert r.status_code == 200
        lesson = r.json()["lesson"]
        assert len(lesson["exercises"]) == 3
        assert lesson["exercises"][0]["id"] == state["exercises"][0]["id"]

    def test_update_lesson(self):
        payload = {
            "title": "TEST Lezione 1 Updated",
            "description": "Saluti base v2",
            "shuffle": True,
            "order": 999,
            "exercises": [
                {
                    "type": "multiple_choice",
                    "question": "Come si dice 'hello' in italiano?",
                    "options": ["Ciao", "Arrivederci", "Grazie", "Prego"],
                    "correct_index": 0,
                },
                {
                    "type": "true_false",
                    "question": "'Grazie' significa 'thank you'?",
                    "correct_bool": True,
                },
                {
                    "type": "open_answer",
                    "question": "Traduci 'Goodbye':",
                    "accepted_answers": ["Arrivederci", "ciao"],
                },
            ],
        }
        r = _put(
            f"/api/lessons/{state['lesson_id']}",
            headers=_auth(state["admin_token"]),
            json=payload,
        )
        assert r.status_code == 200
        lesson = r.json()["lesson"]
        assert lesson["title"] == "TEST Lezione 1 Updated"
        assert lesson["shuffle"] is True
        # exercise IDs preserved by position
        assert lesson["exercises"][0]["id"] == state["exercises"][0]["id"]


# --------------------------- PROGRESS ---------------------------
class TestProgress:
    def test_submit_correct_mc(self):
        ex = state["exercises"][0]  # multiple_choice, correct_index=0
        r = _post(
            "/api/progress/answer",
            headers=_auth(state["student_token"]),
            json={
                "lesson_id": state["lesson_id"],
                "exercise_id": ex["id"],
                "answer": 0,
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["correct"] is True
        assert d["xp_awarded"] == 5
        assert d["already_solved"] is False

    def test_submit_same_mc_already_solved(self):
        ex = state["exercises"][0]
        r = _post(
            "/api/progress/answer",
            headers=_auth(state["student_token"]),
            json={"lesson_id": state["lesson_id"], "exercise_id": ex["id"], "answer": 0},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["correct"] is True
        assert d["already_solved"] is True
        assert d["xp_awarded"] == 0

    def test_submit_wrong_mc(self):
        # create another student for clean slate
        email = f"wrong_{uuid.uuid4().hex[:8]}@test.com"
        reg = _post(
            "/api/auth/register",
            json={"email": email, "password": "student123", "name": "TEST W"},
        )
        tok = reg.json()["token"]
        ex = state["exercises"][0]
        r = _post(
            "/api/progress/answer",
            headers=_auth(tok),
            json={"lesson_id": state["lesson_id"], "exercise_id": ex["id"], "answer": 2},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["correct"] is False
        assert d["xp_awarded"] == 0

    def test_true_false_correct(self):
        ex = state["exercises"][1]
        r = _post(
            "/api/progress/answer",
            headers=_auth(state["student_token"]),
            json={"lesson_id": state["lesson_id"], "exercise_id": ex["id"], "answer": True},
        )
        assert r.status_code == 200
        assert r.json()["correct"] is True
        assert r.json()["xp_awarded"] == 5

    def test_open_answer_case_insensitive(self):
        ex = state["exercises"][2]
        r = _post(
            "/api/progress/answer",
            headers=_auth(state["student_token"]),
            json={"lesson_id": state["lesson_id"], "exercise_id": ex["id"], "answer": "ARRIVEDERCI"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["correct"] is True

    def test_complete_lesson_streak(self):
        r = _post(
            "/api/progress/complete-lesson",
            headers=_auth(state["student_token"]),
            json={
                "lesson_id": state["lesson_id"],
                "total_time_ms": 30000,
                "correct_count": 3,
                "total_count": 3,
                "best_combo": 3,
                "xp_earned": 15,
            },
        )
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["streak"] >= 1
        assert u["last_active_date"] is not None
        # student earned 5+5+5 = 15 XP from answers; should be level 1 (needs 50 for lvl 2)
        assert u["xp"] == 15
        assert u["level"] == 1

    def test_level_calculation(self):
        """Level thresholds: 50->Lv2, 150->Lv3, 250->Lv4"""
        # Manually create 3 students and award XP via repeated exercises? Easier: just verify
        # the formula via /auth/me after awarding enough correct answers.
        # Since student already has 15 XP, create a fresh admin-created lesson with 10 MC exercises
        ex_list = [
            {
                "type": "multiple_choice",
                "question": f"q{i}",
                "options": ["a", "b"],
                "correct_index": 0,
            }
            for i in range(10)
        ]
        r = _post(
            "/api/lessons",
            headers=_auth(state["admin_token"]),
            json={"title": "TEST XP", "description": "xp", "order": 1000, "exercises": ex_list},
        )
        assert r.status_code == 200
        xp_lesson = r.json()["lesson"]

        # Register fresh student
        email = f"xp_{uuid.uuid4().hex[:8]}@test.com"
        reg = _post(
            "/api/auth/register",
            json={"email": email, "password": "student123", "name": "TEST XP"},
        ).json()
        tok = reg["token"]

        # Answer 10 correct => 50 XP => level 2
        for e in xp_lesson["exercises"]:
            _post(
                "/api/progress/answer",
                headers=_auth(tok),
                json={"lesson_id": xp_lesson["id"], "exercise_id": e["id"], "answer": 0},
            )
        me = _get("/api/auth/me", headers=_auth(tok)).json()["user"]
        assert me["xp"] == 50
        assert me["level"] == 2, f"Expected lvl 2 @ 50xp, got {me}"

        # now add 20 more exercises and answer => total 150 xp (lvl 3)
        ex_list2 = [
            {"type": "multiple_choice", "question": f"q{i}", "options": ["a"], "correct_index": 0}
            for i in range(20)
        ]
        r2 = _post(
            "/api/lessons",
            headers=_auth(state["admin_token"]),
            json={"title": "TEST XP2", "description": "xp2", "order": 1001, "exercises": ex_list2},
        ).json()["lesson"]
        for e in r2["exercises"]:
            _post(
                "/api/progress/answer",
                headers=_auth(tok),
                json={"lesson_id": r2["id"], "exercise_id": e["id"], "answer": 0},
            )
        me2 = _get("/api/auth/me", headers=_auth(tok)).json()["user"]
        assert me2["xp"] == 150
        assert me2["level"] == 3, f"Expected lvl 3 @ 150xp, got {me2}"

        # add 20 more => 250 xp => level 4
        ex_list3 = [
            {"type": "multiple_choice", "question": f"q{i}", "options": ["a"], "correct_index": 0}
            for i in range(20)
        ]
        r3 = _post(
            "/api/lessons",
            headers=_auth(state["admin_token"]),
            json={"title": "TEST XP3", "description": "xp3", "order": 1002, "exercises": ex_list3},
        ).json()["lesson"]
        for e in r3["exercises"]:
            _post(
                "/api/progress/answer",
                headers=_auth(tok),
                json={"lesson_id": r3["id"], "exercise_id": e["id"], "answer": 0},
            )
        me3 = _get("/api/auth/me", headers=_auth(tok)).json()["user"]
        assert me3["xp"] == 250
        assert me3["level"] == 4, f"Expected lvl 4 @ 250xp, got {me3}"

        # cleanup
        _delete(f"/api/lessons/{xp_lesson['id']}", headers=_auth(state["admin_token"]))
        _delete(f"/api/lessons/{r2['id']}", headers=_auth(state["admin_token"]))
        _delete(f"/api/lessons/{r3['id']}", headers=_auth(state["admin_token"]))


# --------------------------- SAVED ---------------------------
class TestSaved:
    def test_save_and_list(self):
        ex = state["exercises"][1]
        r = _post(
            "/api/saved",
            headers=_auth(state["student_token"]),
            json={"lesson_id": state["lesson_id"], "exercise_id": ex["id"]},
        )
        assert r.status_code == 200
        r2 = _get("/api/saved", headers=_auth(state["student_token"]))
        assert r2.status_code == 200
        saved = r2.json()["saved"]
        assert any(
            s["exercise"]["id"] == ex["id"] and s["lesson_title"].startswith("TEST") for s in saved
        )

    def test_unsave(self):
        ex = state["exercises"][1]
        r = _delete(
            f"/api/saved?lesson_id={state['lesson_id']}&exercise_id={ex['id']}",
            headers=_auth(state["student_token"]),
        )
        assert r.status_code == 200
        r2 = _get("/api/saved", headers=_auth(state["student_token"])).json()["saved"]
        assert not any(s["exercise"]["id"] == ex["id"] for s in r2)


# --------------------------- CLEANUP ---------------------------
class TestCleanup:
    def test_delete_lesson_as_admin(self):
        r = _delete(
            f"/api/lessons/{state['lesson_id']}", headers=_auth(state["admin_token"])
        )
        assert r.status_code == 200
        # verify 404
        r2 = _get(
            f"/api/lessons/{state['lesson_id']}", headers=_auth(state["admin_token"])
        )
        assert r2.status_code == 404

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Any, Dict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

app = FastAPI(title="Italify API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tortellino")


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, ttl_minutes: int = 60 * 24 * 30) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


def xp_for_level(level: int) -> int:
    """Cumulative XP required to REACH level (level 1 start = 0 XP needed)."""
    # Lv1 -> Lv2 at 50xp; Lv2 -> Lv3 at 50+100=150; each subsequent +100
    if level <= 1:
        return 0
    if level == 2:
        return 50
    # level >= 3
    return 50 + (level - 2) * 100


def compute_level(total_xp: int) -> dict:
    level = 1
    while total_xp >= xp_for_level(level + 1):
        level += 1
    curr_floor = xp_for_level(level)
    next_floor = xp_for_level(level + 1)
    return {
        "level": level,
        "xp_in_level": total_xp - curr_floor,
        "xp_needed": next_floor - curr_floor,
        "next_floor": next_floor,
    }


def user_public(u: dict) -> dict:
    prog = compute_level(u.get("xp", 0))
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "student"),
        "xp": u.get("xp", 0),
        "level": prog["level"],
        "xp_in_level": prog["xp_in_level"],
        "xp_needed": prog["xp_needed"],
        "streak": u.get("streak", 0),
        "last_active_date": u.get("last_active_date"),
        "streak_days": u.get("streak_days", []),
        "created_at": u.get("created_at"),
    }


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    token = None
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=50)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ExerciseIn(BaseModel):
    # types: multiple_choice, true_false, right_wrong, open_answer, word_order, audio, video
    type: Literal[
        "multiple_choice", "true_false", "right_wrong", "open_answer", "word_order", "audio", "video"
    ]
    question: str
    # for multiple_choice: options list + correct_index
    options: Optional[List[str]] = None
    correct_index: Optional[int] = None
    # for true_false & right_wrong
    correct_bool: Optional[bool] = None
    # for open_answer: list of acceptable answers (lowercase match)
    accepted_answers: Optional[List[str]] = None
    # for word_order: list of words in correct order
    correct_order: Optional[List[str]] = None
    # shuffled words to display (optional, computed if not given)
    scrambled: Optional[List[str]] = None
    # media: base64 string OR external URL
    media_base64: Optional[str] = None
    media_url: Optional[str] = None
    media_mime: Optional[str] = None
    # optional explanation shown after answer
    explanation: Optional[str] = None


class LessonIn(BaseModel):
    title: str
    description: str
    shuffle: bool = False
    order: int = 0
    exercises: List[ExerciseIn] = []


class SubmitAnswerIn(BaseModel):
    lesson_id: str
    exercise_id: str
    answer: Any  # int / bool / string / list
    time_ms: Optional[int] = None


class CompleteLessonIn(BaseModel):
    lesson_id: str
    total_time_ms: int
    correct_count: int
    total_count: int
    best_combo: int
    xp_earned: int


class SaveQuestionIn(BaseModel):
    lesson_id: str
    exercise_id: str


# -----------------------------------------------------------------------------
# Auth routes
# -----------------------------------------------------------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    role = "admin" if email == ADMIN_EMAIL else "student"
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": role,
        "xp": 0,
        "streak": 0,
        "last_active_date": None,
        "streak_days": [],
        "answered_correct": [],  # list of exercise_ids correctly answered (no re-xp)
        "saved_questions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": user_public(user)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o password non validi")
    token = create_token(user["id"], user["email"])
    return {"token": token, "user": user_public(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": user_public(user)}


# -----------------------------------------------------------------------------
# Lessons (admin CRUD + student read)
# -----------------------------------------------------------------------------
def _prepare_lesson(lesson_data: LessonIn) -> dict:
    ex_list = []
    for ex in lesson_data.exercises:
        d = ex.model_dump()
        d["id"] = str(uuid.uuid4())
        ex_list.append(d)
    return {
        "id": str(uuid.uuid4()),
        "title": lesson_data.title,
        "description": lesson_data.description,
        "shuffle": lesson_data.shuffle,
        "order": lesson_data.order,
        "exercises": ex_list,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@api.get("/lessons")
async def list_lessons(user: dict = Depends(get_current_user)):
    cursor = db.lessons.find({}, {"_id": 0}).sort("order", 1)
    lessons = await cursor.to_list(500)
    # Attach completion info per user
    completed_lessons = set(user.get("completed_lessons", []))
    for l in lessons:
        l["completed"] = l["id"] in completed_lessons
        l["exercise_count"] = len(l.get("exercises", []))
    return {"lessons": lessons}


@api.get("/lessons/{lesson_id}")
async def get_lesson(lesson_id: str, user: dict = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    return {"lesson": lesson}


@api.post("/lessons")
async def create_lesson(payload: LessonIn, admin: dict = Depends(require_admin)):
    lesson = _prepare_lesson(payload)
    await db.lessons.insert_one(lesson)
    lesson.pop("_id", None)
    return {"lesson": lesson}


@api.put("/lessons/{lesson_id}")
async def update_lesson(lesson_id: str, payload: LessonIn, admin: dict = Depends(require_admin)):
    existing = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    # keep existing exercise IDs where possible (match by position)
    new_ex = []
    old_ex = existing.get("exercises", [])
    for i, ex in enumerate(payload.exercises):
        d = ex.model_dump()
        if i < len(old_ex) and old_ex[i].get("id"):
            d["id"] = old_ex[i]["id"]
        else:
            d["id"] = str(uuid.uuid4())
        new_ex.append(d)
    update = {
        "title": payload.title,
        "description": payload.description,
        "shuffle": payload.shuffle,
        "order": payload.order,
        "exercises": new_ex,
    }
    await db.lessons.update_one({"id": lesson_id}, {"$set": update})
    lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
    return {"lesson": lesson}


@api.delete("/lessons/{lesson_id}")
async def delete_lesson(lesson_id: str, admin: dict = Depends(require_admin)):
    res = await db.lessons.delete_one({"id": lesson_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    return {"ok": True}


# -----------------------------------------------------------------------------
# Exercise evaluation + XP
# -----------------------------------------------------------------------------
def _check_answer(exercise: dict, answer: Any) -> bool:
    t = exercise["type"]
    if t == "multiple_choice":
        try:
            return int(answer) == int(exercise.get("correct_index", -1))
        except Exception:
            return False
    if t in ("true_false", "right_wrong"):
        return bool(answer) == bool(exercise.get("correct_bool"))
    if t == "open_answer":
        accepted = [a.strip().lower() for a in (exercise.get("accepted_answers") or [])]
        return str(answer).strip().lower() in accepted
    if t == "word_order":
        correct = exercise.get("correct_order") or []
        if not isinstance(answer, list):
            return False
        return [str(x) for x in answer] == [str(x) for x in correct]
    if t in ("audio", "video"):
        # audio/video exercises are informational — require an expected response via multiple_choice semantics
        # If correct_index / correct_bool present, use them; otherwise always correct on acknowledge.
        if exercise.get("correct_index") is not None:
            try:
                return int(answer) == int(exercise["correct_index"])
            except Exception:
                return False
        if exercise.get("correct_bool") is not None:
            return bool(answer) == bool(exercise["correct_bool"])
        return True
    return False


@api.post("/progress/answer")
async def submit_answer(payload: SubmitAnswerIn, user: dict = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"id": payload.lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    exercise = next((e for e in lesson["exercises"] if e["id"] == payload.exercise_id), None)
    if not exercise:
        raise HTTPException(status_code=404, detail="Esercizio non trovato")
    is_correct = _check_answer(exercise, payload.answer)
    awarded = 0
    already = exercise["id"] in user.get("answered_correct", [])
    if is_correct and not already:
        awarded = 5
        await db.users.update_one(
            {"id": user["id"]},
            {
                "$inc": {"xp": awarded},
                "$addToSet": {"answered_correct": exercise["id"]},
            },
        )
    return {
        "correct": is_correct,
        "xp_awarded": awarded,
        "already_solved": already,
        "explanation": exercise.get("explanation"),
        "correct_answer": {
            "correct_index": exercise.get("correct_index"),
            "correct_bool": exercise.get("correct_bool"),
            "correct_order": exercise.get("correct_order"),
            "accepted_answers": exercise.get("accepted_answers"),
        },
    }


def _iso_date(dt: datetime) -> str:
    return dt.date().isoformat()


@api.post("/progress/complete-lesson")
async def complete_lesson(payload: CompleteLessonIn, user: dict = Depends(get_current_user)):
    lesson = await db.lessons.find_one({"id": payload.lesson_id}, {"_id": 0})
    if not lesson:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    today = _iso_date(datetime.now(timezone.utc))
    # Streak logic
    last = user.get("last_active_date")
    streak = user.get("streak", 0)
    if last == today:
        pass  # already counted
    elif last:
        yesterday = _iso_date(datetime.now(timezone.utc) - timedelta(days=1))
        streak = streak + 1 if last == yesterday else 1
    else:
        streak = 1
    streak_days = user.get("streak_days", [])
    if today not in streak_days:
        streak_days.append(today)
        streak_days = streak_days[-60:]  # keep last 60
    completed_lessons = user.get("completed_lessons", [])
    if payload.lesson_id not in completed_lessons:
        completed_lessons.append(payload.lesson_id)
    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "streak": streak,
                "last_active_date": today,
                "streak_days": streak_days,
                "completed_lessons": completed_lessons,
            }
        },
    )
    user2 = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"user": user_public(user2)}


# -----------------------------------------------------------------------------
# Saved questions
# -----------------------------------------------------------------------------
@api.post("/saved")
async def save_question(payload: SaveQuestionIn, user: dict = Depends(get_current_user)):
    key = f"{payload.lesson_id}:{payload.exercise_id}"
    await db.users.update_one(
        {"id": user["id"]},
        {"$addToSet": {"saved_questions": key}},
    )
    return {"ok": True}


@api.delete("/saved")
async def unsave_question(lesson_id: str, exercise_id: str, user: dict = Depends(get_current_user)):
    key = f"{lesson_id}:{exercise_id}"
    await db.users.update_one(
        {"id": user["id"]},
        {"$pull": {"saved_questions": key}},
    )
    return {"ok": True}


@api.get("/saved")
async def list_saved(user: dict = Depends(get_current_user)):
    saved_keys = user.get("saved_questions", [])
    result = []
    lessons_cache: Dict[str, dict] = {}
    for key in saved_keys:
        try:
            lesson_id, exercise_id = key.split(":", 1)
        except ValueError:
            continue
        lesson = lessons_cache.get(lesson_id)
        if not lesson:
            lesson = await db.lessons.find_one({"id": lesson_id}, {"_id": 0})
            if lesson:
                lessons_cache[lesson_id] = lesson
        if not lesson:
            continue
        exercise = next((e for e in lesson["exercises"] if e["id"] == exercise_id), None)
        if not exercise:
            continue
        result.append(
            {
                "lesson_id": lesson_id,
                "lesson_title": lesson["title"],
                "exercise": exercise,
            }
        )
    return {"saved": result}


# -----------------------------------------------------------------------------
# Health + startup
# -----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"status": "ok", "app": "Italify"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.lessons.create_index("id", unique=True)
    await db.users.create_index("id", unique=True)
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing and ADMIN_EMAIL:
        admin = {
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Prof. Lorenzo",
            "role": "admin",
            "xp": 0,
            "streak": 0,
            "last_active_date": None,
            "streak_days": [],
            "answered_correct": [],
            "saved_questions": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin)
        logger.info("Seeded admin %s", ADMIN_EMAIL)
    elif existing and not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD), "role": "admin"}},
        )
        logger.info("Updated admin password")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

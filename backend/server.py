from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class EventType(str, Enum):
    GOAL = "goal"
    PENALTY = "penalty"
    CORNER = "corner"
    SUBSTITUTION = "substitution"
    YELLOW_CARD = "yellow_card"
    RED_CARD = "red_card"

class MatchStatus(str, Enum):
    NOT_STARTED = "not_started"
    FIRST_HALF = "first_half"
    HALF_TIME = "half_time"
    SECOND_HALF = "second_half"
    FINISHED = "finished"

class PlayerPosition(str, Enum):
    GOALKEEPER = "goalkeeper"
    DEFENDER = "defender"
    MIDFIELDER = "midfielder"
    FORWARD = "forward"

# Player Model
class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    number: int
    position: PlayerPosition
    
class PlayerCreate(BaseModel):
    name: str
    number: int
    position: PlayerPosition

class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[int] = None
    position: Optional[PlayerPosition] = None

# Team Model
class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    players: List[Player] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class TeamCreate(BaseModel):
    name: str

class TeamUpdate(BaseModel):
    name: Optional[str] = None

# Models
class MatchEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType
    team: str  # "home" or "away"
    minute: int
    player_name: Optional[str] = None
    player_out: Optional[str] = None  # For substitutions
    player_in: Optional[str] = None   # For substitutions
    notes: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class MatchEventCreate(BaseModel):
    event_type: EventType
    team: str
    minute: int
    player_name: Optional[str] = None
    player_out: Optional[str] = None
    player_in: Optional[str] = None
    notes: Optional[str] = None

class Match(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    home_team: str
    away_team: str
    date: datetime = Field(default_factory=datetime.utcnow)
    status: MatchStatus = MatchStatus.NOT_STARTED
    current_minute: int = 0
    home_score: int = 0
    away_score: int = 0
    home_corners: int = 0
    away_corners: int = 0
    home_penalties: int = 0
    away_penalties: int = 0
    home_substitutions: int = 0
    away_substitutions: int = 0
    home_yellow_cards: int = 0
    away_yellow_cards: int = 0
    home_red_cards: int = 0
    away_red_cards: int = 0
    events: List[MatchEvent] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MatchCreate(BaseModel):
    home_team: str
    away_team: str

class MatchUpdate(BaseModel):
    status: Optional[MatchStatus] = None
    current_minute: Optional[int] = None

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Football Match Tracker API"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Match CRUD
@api_router.post("/matches", response_model=Match)
async def create_match(match_input: MatchCreate):
    match = Match(
        home_team=match_input.home_team,
        away_team=match_input.away_team
    )
    await db.matches.insert_one(match.dict())
    return match

@api_router.get("/matches", response_model=List[Match])
async def get_matches():
    matches = await db.matches.find().sort("created_at", -1).to_list(100)
    return [Match(**match) for match in matches]

@api_router.get("/matches/{match_id}", response_model=Match)
async def get_match(match_id: str):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    return Match(**match)

@api_router.patch("/matches/{match_id}", response_model=Match)
async def update_match(match_id: str, match_update: MatchUpdate):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    update_data = {k: v for k, v in match_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.matches.update_one(
        {"id": match_id},
        {"$set": update_data}
    )
    
    updated_match = await db.matches.find_one({"id": match_id})
    return Match(**updated_match)

@api_router.delete("/matches/{match_id}")
async def delete_match(match_id: str):
    result = await db.matches.delete_one({"id": match_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Match not found")
    return {"message": "Match deleted successfully"}

# Event management
@api_router.post("/matches/{match_id}/events", response_model=Match)
async def add_event(match_id: str, event_input: MatchEventCreate):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    event = MatchEvent(**event_input.dict())
    
    # Update counters based on event type
    update_fields = {
        "updated_at": datetime.utcnow()
    }
    
    team_prefix = "home_" if event_input.team == "home" else "away_"
    
    if event_input.event_type == EventType.GOAL:
        update_fields[f"{team_prefix}score"] = match[f"{team_prefix}score"] + 1
    elif event_input.event_type == EventType.PENALTY:
        update_fields[f"{team_prefix}penalties"] = match[f"{team_prefix}penalties"] + 1
    elif event_input.event_type == EventType.CORNER:
        update_fields[f"{team_prefix}corners"] = match[f"{team_prefix}corners"] + 1
    elif event_input.event_type == EventType.SUBSTITUTION:
        update_fields[f"{team_prefix}substitutions"] = match[f"{team_prefix}substitutions"] + 1
    elif event_input.event_type == EventType.YELLOW_CARD:
        update_fields[f"{team_prefix}yellow_cards"] = match[f"{team_prefix}yellow_cards"] + 1
    elif event_input.event_type == EventType.RED_CARD:
        update_fields[f"{team_prefix}red_cards"] = match[f"{team_prefix}red_cards"] + 1
    
    await db.matches.update_one(
        {"id": match_id},
        {
            "$push": {"events": event.dict()},
            "$set": update_fields
        }
    )
    
    updated_match = await db.matches.find_one({"id": match_id})
    return Match(**updated_match)

@api_router.delete("/matches/{match_id}/events/{event_id}", response_model=Match)
async def remove_event(match_id: str, event_id: str):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Find the event to remove
    event_to_remove = None
    for event in match.get("events", []):
        if event["id"] == event_id:
            event_to_remove = event
            break
    
    if not event_to_remove:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Update counters
    update_fields = {"updated_at": datetime.utcnow()}
    team_prefix = "home_" if event_to_remove["team"] == "home" else "away_"
    event_type = event_to_remove["event_type"]
    
    if event_type == "goal":
        update_fields[f"{team_prefix}score"] = max(0, match[f"{team_prefix}score"] - 1)
    elif event_type == "penalty":
        update_fields[f"{team_prefix}penalties"] = max(0, match[f"{team_prefix}penalties"] - 1)
    elif event_type == "corner":
        update_fields[f"{team_prefix}corners"] = max(0, match[f"{team_prefix}corners"] - 1)
    elif event_type == "substitution":
        update_fields[f"{team_prefix}substitutions"] = max(0, match[f"{team_prefix}substitutions"] - 1)
    elif event_type == "yellow_card":
        update_fields[f"{team_prefix}yellow_cards"] = max(0, match[f"{team_prefix}yellow_cards"] - 1)
    elif event_type == "red_card":
        update_fields[f"{team_prefix}red_cards"] = max(0, match[f"{team_prefix}red_cards"] - 1)
    
    await db.matches.update_one(
        {"id": match_id},
        {
            "$pull": {"events": {"id": event_id}},
            "$set": update_fields
        }
    )
    
    updated_match = await db.matches.find_one({"id": match_id})
    return Match(**updated_match)

# Match summary
@api_router.get("/matches/{match_id}/summary")
async def get_match_summary(match_id: str):
    match = await db.matches.find_one({"id": match_id})
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    match_obj = Match(**match)
    
    # Group events by type
    goals = [e for e in match_obj.events if e.event_type == EventType.GOAL]
    penalties = [e for e in match_obj.events if e.event_type == EventType.PENALTY]
    corners = [e for e in match_obj.events if e.event_type == EventType.CORNER]
    substitutions = [e for e in match_obj.events if e.event_type == EventType.SUBSTITUTION]
    yellow_cards = [e for e in match_obj.events if e.event_type == EventType.YELLOW_CARD]
    red_cards = [e for e in match_obj.events if e.event_type == EventType.RED_CARD]
    
    return {
        "match_id": match_obj.id,
        "home_team": match_obj.home_team,
        "away_team": match_obj.away_team,
        "final_score": f"{match_obj.home_score} - {match_obj.away_score}",
        "status": match_obj.status,
        "date": match_obj.date,
        "statistics": {
            "goals": {
                "home": match_obj.home_score,
                "away": match_obj.away_score,
                "total": match_obj.home_score + match_obj.away_score
            },
            "corners": {
                "home": match_obj.home_corners,
                "away": match_obj.away_corners,
                "total": match_obj.home_corners + match_obj.away_corners
            },
            "penalties": {
                "home": match_obj.home_penalties,
                "away": match_obj.away_penalties,
                "total": match_obj.home_penalties + match_obj.away_penalties
            },
            "substitutions": {
                "home": match_obj.home_substitutions,
                "away": match_obj.away_substitutions,
                "total": match_obj.home_substitutions + match_obj.away_substitutions
            },
            "yellow_cards": {
                "home": match_obj.home_yellow_cards,
                "away": match_obj.away_yellow_cards,
                "total": match_obj.home_yellow_cards + match_obj.away_yellow_cards
            },
            "red_cards": {
                "home": match_obj.home_red_cards,
                "away": match_obj.away_red_cards,
                "total": match_obj.home_red_cards + match_obj.away_red_cards
            }
        },
        "timeline": {
            "goals": [{
                "minute": e.minute,
                "team": e.team,
                "player": e.player_name
            } for e in sorted(goals, key=lambda x: x.minute)],
            "penalties": [{
                "minute": e.minute,
                "team": e.team,
                "player": e.player_name
            } for e in sorted(penalties, key=lambda x: x.minute)],
            "corners": [{
                "minute": e.minute,
                "team": e.team
            } for e in sorted(corners, key=lambda x: x.minute)],
            "substitutions": [{
                "minute": e.minute,
                "team": e.team,
                "player_out": e.player_out,
                "player_in": e.player_in
            } for e in sorted(substitutions, key=lambda x: x.minute)],
            "cards": {
                "yellow": [{
                    "minute": e.minute,
                    "team": e.team,
                    "player": e.player_name
                } for e in sorted(yellow_cards, key=lambda x: x.minute)],
                "red": [{
                    "minute": e.minute,
                    "team": e.team,
                    "player": e.player_name
                } for e in sorted(red_cards, key=lambda x: x.minute)]
            }
        },
        "total_events": len(match_obj.events)
    }

# ==================== TEAM ROUTES ====================

@api_router.post("/teams", response_model=Team)
async def create_team(team_input: TeamCreate):
    # Check if team already exists
    existing = await db.teams.find_one({"name": team_input.name})
    if existing:
        raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    team = Team(name=team_input.name)
    await db.teams.insert_one(team.dict())
    return team

@api_router.get("/teams", response_model=List[Team])
async def get_teams():
    teams = await db.teams.find().sort("name", 1).to_list(100)
    return [Team(**team) for team in teams]

@api_router.get("/teams/{team_id}", response_model=Team)
async def get_team(team_id: str):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return Team(**team)

@api_router.get("/teams/by-name/{team_name}", response_model=Team)
async def get_team_by_name(team_name: str):
    team = await db.teams.find_one({"name": team_name})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return Team(**team)

@api_router.patch("/teams/{team_id}", response_model=Team)
async def update_team(team_id: str, team_update: TeamUpdate):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    update_data = {k: v for k, v in team_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.teams.update_one({"id": team_id}, {"$set": update_data})
    updated_team = await db.teams.find_one({"id": team_id})
    return Team(**updated_team)

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str):
    result = await db.teams.delete_one({"id": team_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"message": "Team deleted successfully"}

# ==================== PLAYER ROUTES ====================

@api_router.post("/teams/{team_id}/players", response_model=Team)
async def add_player_to_team(team_id: str, player_input: PlayerCreate):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check if number is already taken in this team
    for p in team.get("players", []):
        if p["number"] == player_input.number:
            raise HTTPException(status_code=400, detail=f"Number {player_input.number} is already taken")
    
    player = Player(**player_input.dict())
    
    await db.teams.update_one(
        {"id": team_id},
        {
            "$push": {"players": player.dict()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    updated_team = await db.teams.find_one({"id": team_id})
    return Team(**updated_team)

@api_router.patch("/teams/{team_id}/players/{player_id}", response_model=Team)
async def update_player(team_id: str, player_id: str, player_update: PlayerUpdate):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Find and update the player
    players = team.get("players", [])
    player_found = False
    
    for i, p in enumerate(players):
        if p["id"] == player_id:
            player_found = True
            if player_update.name is not None:
                players[i]["name"] = player_update.name
            if player_update.number is not None:
                # Check if new number is taken by another player
                for j, other in enumerate(players):
                    if j != i and other["number"] == player_update.number:
                        raise HTTPException(status_code=400, detail=f"Number {player_update.number} is already taken")
                players[i]["number"] = player_update.number
            if player_update.position is not None:
                players[i]["position"] = player_update.position
            break
    
    if not player_found:
        raise HTTPException(status_code=404, detail="Player not found")
    
    await db.teams.update_one(
        {"id": team_id},
        {
            "$set": {
                "players": players,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    updated_team = await db.teams.find_one({"id": team_id})
    return Team(**updated_team)

@api_router.delete("/teams/{team_id}/players/{player_id}", response_model=Team)
async def remove_player_from_team(team_id: str, player_id: str):
    team = await db.teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    await db.teams.update_one(
        {"id": team_id},
        {
            "$pull": {"players": {"id": player_id}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    updated_team = await db.teams.find_one({"id": team_id})
    return Team(**updated_team)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

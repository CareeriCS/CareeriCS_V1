from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from dependencies import get_db
from schemas import UserProfileReadSchema, UserProfileUpsertSchema
from services.profile_service import get_user_profile_service, upsert_user_profile_service


router = APIRouter(prefix="/users", tags=["Users Profile"])


@router.get("/profile/{user_id}", response_model=UserProfileReadSchema)
async def get_user_profile_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return get_user_profile_service(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/profile/{user_id}", response_model=UserProfileReadSchema)
async def upsert_user_profile_endpoint(
    user_id: UUID,
    payload: UserProfileUpsertSchema = Body(...),
    db: Session = Depends(get_db),
):
    try:
        return upsert_user_profile_service(db, user_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.patch("/profile/{user_id}", response_model=UserProfileReadSchema)
async def update_user_profile_endpoint(
    user_id: UUID,
    payload: UserProfileUpsertSchema = Body(...),
    db: Session = Depends(get_db),
):
    try:
        return upsert_user_profile_service(db, user_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

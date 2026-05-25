from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from dependencies import get_db
from schemas import (
    JourneyTrackProgressListSchema,
    JourneyTrackProgressReadSchema,
    JourneyTrackProgressUpsertSchema,
)
from services.journey.progress_service import (
    delete_user_journey_progress_service,
    get_user_journey_progress_service,
    upsert_user_journey_progress_service,
)


router = APIRouter(prefix="/journey", tags=["Journey Progress"])


@router.get("/progress/{user_id}", response_model=JourneyTrackProgressListSchema)
async def get_user_journey_progress_endpoint(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        return get_user_journey_progress_service(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/progress/{user_id}/tracks/{track_id}", response_model=JourneyTrackProgressReadSchema)
async def upsert_user_journey_progress_endpoint(
    user_id: UUID,
    track_id: UUID,
    payload: JourneyTrackProgressUpsertSchema = Body(...),
    db: Session = Depends(get_db),
):
    try:
        return upsert_user_journey_progress_service(db, user_id, track_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/progress/{user_id}/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_journey_progress_endpoint(
    user_id: UUID,
    track_id: UUID,
    db: Session = Depends(get_db),
):
    try:
        delete_user_journey_progress_service(db, user_id, track_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

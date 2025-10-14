import os
from fastapi import FastAPI, Depends, HTTPException  # type: ignore
from fastapi.responses import StreamingResponse  # type: ignore
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials  # type: ignore
from openai import OpenAI  # type: ignore
from pydantic import BaseModel, Field, validator  # type: ignore

app = FastAPI()

clerk_config = ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL"))
clerk_guard = ClerkHTTPBearer(clerk_config)

class Visit(BaseModel):
    patient_name: str = Field(..., min_length=1, description="Patient name is required")
    date_of_visit: str = Field(..., min_length=1, description="Date of visit is required")
    notes: str = Field(..., min_length=1, description="Notes are required")

    @validator('patient_name')
    def validate_patient_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Patient name cannot be empty')
        return v.strip()

    @validator('date_of_visit')
    def validate_date_of_visit(cls, v):
        if not v or not v.strip():
            raise ValueError('Date of visit cannot be empty')
        return v.strip()

    @validator('notes')
    def validate_notes(cls, v):
        if not v or not v.strip():
            raise ValueError('Notes cannot be empty')
        return v.strip()
system_prompt = """
You are provided with notes written by a doctor from a patient's visit.
Your job is to summarize the visit for the doctor and provide an email.
Reply with exactly three sections with the headings:
### Summary of visit for the doctor's records
### Next steps for the doctor
### Draft of email to patient in patient-friendly language
"""

def user_prompt_for(visit: Visit) -> str:
    return f"""Create the summary, next steps and draft email for:
Patient Name: {visit.patient_name}
Date of Visit: {visit.date_of_visit}
Notes:
{visit.notes}"""

@app.post("/api")
def consultation_summary(
    visit: Visit,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    user_id = creds.decoded["sub"]  # User ID from JWT - available for future use
    # We now know which user is making the request! 
    # You could use user_id to:
    # - Track usage per user
    # - Store generated ideas in a database
    # - Apply user-specific limits or customization
    
    try:
        client = OpenAI()
        user_prompt = user_prompt_for(visit)

        prompt = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        stream = client.chat.completions.create(model="gpt-5-nano", messages=prompt, stream=True)

        def event_stream():
            for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    lines = text.split("\n")
                    for line in lines[:-1]:
                        yield f"data: {line}\n\n"
                        yield "data:  \n"
                    yield f"data: {lines[-1]}\n\n"
            
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
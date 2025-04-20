import logging
import json
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import uvicorn

# Import functionality from app.py
from app import (
    debug, 
    questions, 
    process_questionnaire_answers, 
    assessments_table
)

# Create FastAPI app
app = FastAPI(title="Neurodiverse Job Analysis API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Pydantic models for request/response validation
class QuestionnaireSubmission(BaseModel):
    answers: Dict[str, Any]
    job_description: Optional[str] = None
    
class ResultResponse(BaseModel):
    assessment_id: str
    profile: Dict[str, Any]
    recommendations: List[Dict[str, Any]]

# Define routes
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.get("/questionnaire")
async def get_questionnaire():
    """Return questionnaire data"""
    return {"questions": questions}

@app.post("/submit_questionnaire")
async def submit_questionnaire(submission: QuestionnaireSubmission):
    """Process submitted questionnaire"""
    try:
        # Process answers and get results by calling function from app.py
        result = process_questionnaire_answers(submission.model_dump().get("answers", {}))
        
        # Parse the response
        if isinstance(result, dict) and "statusCode" in result:
            if result["statusCode"] == 200:
                return json.loads(result["body"])
            else:
                raise HTTPException(
                    status_code=result["statusCode"],
                    detail=json.loads(result["body"]).get("error", "Unknown error")
                )
        return result
        
    except Exception as e:
        logging.error(f"Error processing questionnaire: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/results/{assessment_id}")
async def get_results(assessment_id: str):
    """Get assessment results by ID"""
    try:
        # Retrieve the stored assessment from DynamoDB
        debug(f"Retrieving assessment with ID: {assessment_id}")
        response = assessments_table.get_item(
            Key={
                'assessment_id': assessment_id
            }
        )
        
        # Check if assessment was found
        if 'Item' not in response:
            debug(f"Assessment ID {assessment_id} not found in database")
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Get the stored data
        item = response['Item']
        
        # Parse stored JSON strings
        if 'profile' in item and isinstance(item['profile'], str):
            item['profile'] = json.loads(item['profile'])
        
        if 'recommendations' in item and isinstance(item['recommendations'], str):
            item['recommendations'] = json.loads(item['recommendations'])
        
        # Return result data
        return ResultResponse(
            assessment_id=assessment_id,
            profile=item.get('profile', {}),
            recommendations=item.get('recommendations', [])
        )
            
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error fetching results: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the application with uvicorn when script is executed directly
    # This is useful for local development
    # In production, use a proper ASGI server to run the application
    uvicorn.run(app, host="0.0.0.0", port=8000)

# PALS FastAPI Backend Service

This backend service prepares the computational layer for PALS (Intelligent Emergency Rescue & Medical Response Optimisation System).

## Architecture Role (Stage 3):
- Modular REST API endpoints for road routing, incident parameter validation, and simulation logging.
- Decoupled from the future PuLP Mixed-Integer Linear Programming (MILP) algorithm to be introduced in Stage 4.

## Setup & Running Locally:

```bash
# 1. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run development server
uvicorn main:app --reload --port 8000
```

Once running, interactive API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`


"""
PALS — Intelligent Emergency Rescue & Medical Response Optimisation System
Entry point bridging backend/main.py to backend/app/main.py
"""

from app.main import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

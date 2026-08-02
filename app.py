import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from agent import graph, initial_state

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="PI Debate")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class DebateRequest(BaseModel):
    question: str = Field(..., min_length=1)


AGENT_LABELS = {
    "Scientist": "scientist",
    "Philosopher": "philosopher",
    "Judge": "judge",
}

RESPONSE_KEYS = {
    "Scientist": "scientist_response",
    "Philosopher": "philosopher_response",
    "Judge": "judge_response",
}


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/debate")
def debate(request: DebateRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question can't be empty")

    state = {**initial_state, "question": question}
    final_state = graph.invoke(state)

    return {
        "question": question,
        "scientist": final_state.get("scientist_response"),
        "philosopher": final_state.get("philosopher_response"),
        "judge": final_state.get("judge_response"),
    }


@app.post("/api/debate/stream")
def debate_stream(request: DebateRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question can't be empty")

    def event_stream():
        state = {**initial_state, "question": question}
        yield _sse("status", {"phase": "controller", "label": "debate_controller", "message": "starting"})

        try:
            for update in graph.stream(state, stream_mode="updates"):
                for node_name, payload in update.items():
                    if node_name == "Debate controller":
                        yield _sse(
                            "status",
                            {
                                "phase": "controller",
                                "label": "debate_controller",
                                "message": "routing agents",
                            },
                        )
                        continue

                    agent = AGENT_LABELS.get(node_name)
                    key = RESPONSE_KEYS.get(node_name)
                    if not agent or not key:
                        continue

                    content = (payload or {}).get(key) or ""
                    event = "final" if agent == "judge" else "agent"
                    yield _sse(
                        event,
                        {
                            "agent": agent,
                            "label": node_name.lower(),
                            "content": content,
                        },
                    )

            yield _sse("done", {"message": "complete"})
        except Exception as exc:
            yield _sse("error", {"message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

from langchain_openai import ChatOpenAI
from config import TEMPERATURE, MAX_TOKENS, DEFAULT_MODEL, OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENAI_BASE_URL

def make_llm(model=DEFAULT_MODEL, **kw):
  # api_key = OPENAI_API_KEY or OPENROUTER_API_KEY
  # if not api_key:
  #   raise EnvironmentError(
  #     "No API key configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY in your environment."
  #   )

  # kwargs = {
  #   "model": model,
  #   "api_key": api_key,
  #   "temperature": TEMPERATURE,
  #   "max_tokens": MAX_TOKENS,
  #   **kw,
  # }
  # if OPENROUTER_BASE_URL and OPENROUTER_API_KEY and not OPENAI_API_KEY:
  #   kwargs["base_url"] = OPENROUTER_BASE_URL
  # else:
  #   kwargs["base_url"] = OPENAI_BASE_URL

  # source = "OPENAI" if OPENAI_API_KEY else "OPENROUTER" if OPENROUTER_API_KEY else "none"
  # print(f"LLM init: model={model}, api_key_source={source}, base_url={kwargs.get('base_url')}")

  # return ChatOpenAI(**kwargs)
  
  if not OPENROUTER_API_KEY:
    raise EnvironmentError(
      "OPENROUTER_API_KEY is not configured."
  )

  return ChatOpenAI(
    model=model,
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
    temperature=TEMPERATURE,
    max_tokens=MAX_TOKENS,
    **kw,
  )

llm = make_llm()

# ------- Prompts for each agent ------
from prompt import SCIENTIST_PROMPT, PHILOSOPHER_PROMPT, JUDGE_PROMPT

# ------ Tools & state ---------

from typing import Any
from typing import TypedDict

class DebateState(TypedDict):
  question: str
  scientist_response: str | None
  philosopher_response: str | None
  judge_response: str | None

'''
In multiple agent store the output in a dict
`responses: dict[str, str]` instead of field for each agent
responses["scientist"] = "..."
responses["philosopher"] = "..."
responses["economist"] = "..."
'''

# initial state
initial_state = {
    "question": "",
    "scientist_response": None,
    "philosopher_response": None,
    "judge_response": None,
}

# debate controller
def debate_controller(state: DebateState) -> dict[str, Any]:
  question = state["question"].strip()

  if not question:
    raise ValueError("Question can't be empty")

  print(f"Starting debate for {question}")

  return {} # return no update

# science agent
def scientist_agent(state: DebateState) -> dict[str, Any]:
  question = state["question"].strip()
  # print(f"Scientist asking: {question}")

  prompt = f"""
  {SCIENTIST_PROMPT}

  Question:{question}
  """

  res = llm.invoke(prompt)
  # print(f"Scientist response: {res.content}")

  return {"scientist_response":res.content}

# philosophy agent
def philosopher_agent(state: DebateState) -> dict[str, Any]:
  question = state["question"].strip()
  # print(f"Philosopher asking: {question}")

  prompt = f"""
  {PHILOSOPHER_PROMPT}

  Question:{question}
  """

  res = llm.invoke(prompt)
  # print(f"Philosopher response: {res.content}")

  return {"philosopher_response":res.content}

# judge agent
def judge_agent(state: DebateState) -> dict[str, Any]:
  question = state["question"].strip()
  scientist_response = state["scientist_response"].strip()
  philosopher_response = state["philosopher_response"].strip()

  # print(f"Judge asking: {question}")
  prompt=f"""
  {JUDGE_PROMPT}

  Question:{question}
  Scientist:{scientist_response}
  Philosopher:{philosopher_response}
  """

  res = llm.invoke(prompt)
  # print(f"Judge response: {res.content}")

  return {"judge_response":res.content}


# -------- Agent loop ------- 

from langgraph.graph import StateGraph, START, END

builder = StateGraph(DebateState)
builder.add_node("Debate controller", debate_controller)
builder.add_node("Scientist", scientist_agent)
builder.add_node("Philosopher", philosopher_agent)
builder.add_node("Judge", judge_agent)


builder.add_edge(START, "Debate controller")
builder.add_edge("Debate controller", "Scientist")
builder.add_edge("Debate controller", "Philosopher")
builder.add_edge("Scientist", "Judge")
builder.add_edge("Philosopher", "Judge")

builder.add_edge("Judge", END)

graph = builder.compile()

def run_agent(question: str) -> dict[str, Any]:
  state = initial_state.copy()
  state["question"] = question

  final_state = graph.invoke(state)
  return final_state
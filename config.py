import os 
from dotenv import load_dotenv

load_dotenv()

# API keys
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTROPIC_API_KEY = os.getenv("ANTROPIC_API_KEY")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_BASE_URL = "https://api.openai.com/v1"

# Model setting
MODEL_NAME="gpt-4o"
TEMPERATURE=0.7
MAX_TOKENS=4096
DEFAULT_MODEL="openai/gpt-4.1-mini"

# App setting
DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "t")
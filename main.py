from agent import scientist_agent, philosopher_agent, judge_agent
from agent import run_agent, DebateState

if __name__ == "__main__":
    question = input("Enter a question for the debate: ").strip()

    answer = run_agent(question)

    print("\n" + "=" * 60)
    print("SCIENTIST")
    print("=" * 60)
    print(answer["scientist_response"])

    print("\n" + "=" * 60)
    print("PHILOSOPHER")
    print("=" * 60)
    print(answer["philosopher_response"])

    print("\n" + "=" * 60)
    print("JUDGE — FINAL ANSWER")
    print("=" * 60)
    print(answer["judge_response"])
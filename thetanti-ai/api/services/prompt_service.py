class PromptService:
    def prepare(self, prompt: str, model: str) -> str:
        return " ".join(prompt.strip().split())


prompt_service = PromptService()

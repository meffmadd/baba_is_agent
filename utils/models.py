from typing import Self, List, Literal, Tuple
from pydantic import BaseModel
from textwrap import dedent, indent

class GameMoves(BaseModel):
    moves: List[Literal["up", "down", "left", "right"]]
    goal: str

class AugmentedGameMoves(GameMoves):
    stop_positions: List[Tuple[int, int]]
    objects_on_path: List[str]
    # is_winning: bool

    def __str__(self) -> str:
        return dedent(f"""
        Moves: {self.moves}
        Goal of moves: {self.goal}
        Assuming movement is not affected, stop positions for this move are: {self.stop_positions}
        Assuming movement is not affected, "YOU" would encounter the following objects along the path (unordered): {self.objects_on_path}
        """).strip()

class MoveOptions(BaseModel):
    options: List[GameMoves]

class AugmentedMoveOptions(BaseModel):
    options: List[AugmentedGameMoves]
    you_positions: List[Tuple[int, int]]
    win_positions: List[Tuple[int, int]]

    def __str__(self) -> str:
        return dedent(f"""
        "YOU" are currently at position(s): {self.you_positions}
        Positions leading to a win state are currently at position: {self.win_positions if len(self.win_positions) > 0 else "Corrently no win positions active..."}
        Move options:
        {"\n\t".join([f"- Option {i+1}:\n{indent(str(opt), prefix="\t\t")}" for i, opt in enumerate(self.options)])}
        """).strip()

class Reasoning(BaseModel):
    reasoning: str
    suggestion: GameMoves

class Rule(BaseModel):
    entity: str
    state: str

    def __str__(self) -> str:
        return f'{self.entity} is {self.state}'

    def __hash__(self) -> int:
        return str(self).__hash__()

    @classmethod
    def from_string(cls, s: str) -> Self:
        entity, state = [e.strip() for e in s.strip().split("is")]
        return cls(entity=entity, state=state)

from typing import Self, List, Literal, Set, Tuple
from pydantic import BaseModel
from textwrap import dedent, indent

class Position(BaseModel):
    x: int
    y: int
    last_move: Literal["up", "down", "left", "right"]

    def __str__(self):
        return dedent(f"""
        Position (x,y): ({self.x},{self.y})
        Last move to get to position: {self.last_move}
        """).strip()

class GameMoves(BaseModel):
    moves: List[Position]
    goal: str

class MoveOptions(BaseModel):
    options: List[GameMoves]

class AugmentedGameMoves(GameMoves):
    is_valid: bool

    def __str__(self) -> str:
        return dedent(f"""
        Moves:
        {"\n\n".join([str(m) for m in self.moves])}
        Goal of moves: {self.goal}
        The generated moves are {'valid' if self.is_valid else 'not valid'}!
        {'This means the moves result in the intermediate/final positions specified in the moves list i.e. a complete path can be found to the final position. If the moves match with the specified goal, this means the goal can be accomplished.'
            if self.is_valid else
        'This means the moves cannot be accomplished because an (intermediate) position within the moves list cannot be reached. Do not pursue this path as the goal cannot be accomplished!'}
        """).strip()

class AugmentedMoveOptions(BaseModel):
    # TODO: how do we augment the options?
    options: List[AugmentedGameMoves]

    def __str__(self) -> str:
        return dedent(f"""
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

class GameInsights(BaseModel):
    active_rules: Set[Rule]
    relevant_entities: List[List[tuple]]
    you_positions: List[Tuple[int, int]]
    win_positions: List[Tuple[int, int]]
    path_to_win: GameMoves | None

    @staticmethod
    def from_state(game_state: str) -> "GameInsights":
        from .path_finding import shortest_path
        from .base import get_rules, game_state_coords, get_state_positions

        win_positions = get_state_positions(game_state, "win")
        move: GameMoves | None = None
        shortest_path_len = 1e6
        last_moves: list[Literal["up", "down", "left", "right"]] = ["up", "down", "left", "right"]
        for last_move in last_moves:
            for pos in win_positions:
                p = shortest_path(game_state, pos, last_move)
                if len(p) > 0 and len(p) < shortest_path_len:
                    shortest_path_len = len(p)
                    move = GameMoves(moves=[Position(x=pos[0], y=pos[1], last_move=last_move)], goal="Move to Goal")

        return GameInsights(
            active_rules=get_rules(game_state),
            relevant_entities=game_state_coords(game_state),
            you_positions=get_state_positions(game_state, "you"),
            win_positions=win_positions,
            path_to_win=move
        )

    def __str__(self) -> str:
        return dedent(f"""
        The current active rules are:
        {[str(r).upper() for r in self.active_rules]}

        The coordinates of relevant entities are:
        {"\n".join([str(c) for c in self.relevant_entities])}

        'YOU' are currently at position(s): {self.you_positions}.
        Wining positions are currently at: {self.win_positions}.
        {f'There currently is a path to the win position. Executing this move wins the level. The move is:\n{str(self.path_to_win)}' if self.path_to_win else
        'There currently exists no path to a win position! You will have to manipulate the game rules to win the level.'}
        """).strip()

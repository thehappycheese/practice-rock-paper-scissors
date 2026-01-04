import { create } from 'zustand';
import { Button } from './components/ui/button';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ThemeToggle } from './components/theme_toggle';
import asset_paper from "./assets/sounds/paper.wav";
import asset_scissors from "./assets/sounds/scissors.wav";
import asset_rock from "./assets/sounds/rock.wav";
import asset_win from "./assets/sounds/win.wav";
import asset_lose from "./assets/sounds/lose.wav";
import asset_tie from "./assets/sounds/tie.wav";
import { Card, CardContent } from './components/ui/card';
import "./app.css";


async function load_sound(context: AudioContext, url: string) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
}

function play_sound(context: AudioContext, buffer: AudioBuffer, volume: number = 1.0) {
    const source = context.createBufferSource();
    const gainNode = context.createGain();
    source.buffer = buffer;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(context.destination);
    source.start(0);
}

const useSound = (context: AudioContext, url: string) => {
    const sound = useRef<AudioBuffer | null>(null);
    useEffect(() => {
        load_sound(context, url).then(audio_buffer => sound.current = audio_buffer)
    });
    return {
        play(volume: number = 1) {
            if (sound.current === null) return;
            play_sound(context, sound.current, volume)
        }
    }
};

const useSounds = <T extends Record<string,string>>(context: AudioContext, source_urls: T):{
    [K in keyof T]: (volume?: number) => void
} => {
    const sound = useMemo<Record<string, AudioBuffer>>(()=>({}),[]);
    
    useEffect(() => {
        for (const [name, url] of Object.entries(source_urls)) {
            load_sound(context, url).then(audio_buffer => {
                sound[name] = audio_buffer;
            });
        }
    }, [sound, context, source_urls]);
    
    return useMemo(() => {
        const playFunctions = {} as { [K in keyof T]: (volume?: number) => void };
        
        for (const name of Object.keys(source_urls) as Array<keyof T>) {
            playFunctions[name] = (volume: number = 1) => {
                const buffer = sound[name as string];
                if (!buffer) return;
                play_sound(context, buffer, volume);
            };
        }
        
        return playFunctions;
    }, [sound, context, source_urls]);
}

type WinLoseTie = "win" | "lose" | "tie";
type RPS = "rock" | "paper" | "scissors";
type BattleState =
    {
        type: "chant"
    }
    | {
        type: "suspense",
        player_move: RPS,
    }
    | {
        type: "revealed",
        player_move: RPS,
        opponent_move: RPS,
        win_lose_tie: WinLoseTie
    }
    | {
        type: "evaluated",
        player_move: RPS,
        opponent_move: RPS,
        win_lose_tie: WinLoseTie
    };

const RULES: Record<RPS, Record<RPS, WinLoseTie>> = {
    "rock": {
        "rock": "tie",
        "paper": "lose",
        "scissors": "win",
    },
    "paper": {
        "rock": "win",
        "paper": "tie",
        "scissors": "lose",
    },
    "scissors": {
        "rock": "lose",
        "paper": "win",
        "scissors": "tie",
    }
};

type GameState = {
    score_player: number,
    score_opponent: number,
    battle_state: BattleState,
    play_move: (player_move: RPS) => void,
    reset:()=>void,
};

const createAppState = (sounds:Record<string,(v?:number)=>void>)=>create<GameState>((set) => ({
    score_player: 0,
    score_opponent: 0,
    battle_state: { type: "chant" } as BattleState,
    play_move: async (player_move) => {
        set(state=>{
            if (state.battle_state.type !== "chant") return state;
            return {
                ...state,
                battle_state: { type: "suspense", player_move},
            };
        })
        setTimeout(()=>set(state=>{
            if(state.battle_state.type!=="suspense") return state;
            const opponent_move: RPS = (["rock", "paper", "scissors"] as RPS[])[Math.floor(Math.random() * 3)];
            const win_lose_tie = RULES[state.battle_state.player_move][opponent_move];
            setTimeout(()=>set(state=>{
                if(state.battle_state.type!=="revealed") return state;
                //sounds[state.battle_state.opponent_move]()
                if(state.battle_state.win_lose_tie==="win"){
                    sounds["coin"]();
                }else if(state.battle_state.win_lose_tie==="lose"){
                    sounds["lose"]();
                }else{
                    sounds["tie"]();
                }
                return {...state, battle_state:{
                    ...state.battle_state,
                    type:"evaluated",

                }}
            }), 500)
            return {
                ...state,
                score_player   : state.score_player   + Number(win_lose_tie === "win"),
                score_opponent : state.score_opponent + Number(win_lose_tie === "lose"),
                battle_state   : { 
                    type: "revealed",
                    player_move:state.battle_state.player_move,
                    opponent_move,
                    win_lose_tie,
                },
            }
        }), 800);
    },
    reset:()=>set(state=>({
        ...state,
        battle_state:{type:'chant'}
    }))
}));


function App() {
    const context = useMemo(() => new AudioContext(), []);
    const sounds = useSounds(context,{
        coin:asset_win,
        paper:asset_paper,
        scissors:asset_scissors,
        rock:asset_rock,
        lose:asset_lose,
        tie:asset_tie,
    });
    const sound_paper    = useSound(context, asset_paper);
    const sound_scissors = useSound(context, asset_scissors);
    const sound_rock     = useSound(context, asset_rock);
    const get_state      = useMemo(()=>createAppState(sounds), []);
    const state          = get_state();


    let player_hand  : ReactNode = "[HAND]";
    let opponent_hand: ReactNode = "[HAND]";
    if (state.battle_state.type === "chant") {
        player_hand = <div className="animate-hand-bob">[HAND]</div>
        opponent_hand = <div className="animate-hand-bob" style={{ animationDelay: "-1.01s" }}>[HAND]</div>
    } else if (state.battle_state.type === "revealed") {
        player_hand = <div>{state.battle_state.player_move.toUpperCase()}</div>;
        opponent_hand = <div className="hand-slap-right">{state.battle_state.opponent_move.toUpperCase()}</div>;
    } else if (state.battle_state.type === "suspense") {
        player_hand = <div className="hand-slap-left">{state.battle_state.player_move.toUpperCase()}</div>
        opponent_hand = <div className="intensifies">...</div>
    } else if(state.battle_state.type==="evaluated"){
        console.log(state)
        if(state.battle_state.win_lose_tie==="win"){
            player_hand = <div className="winning">{state.battle_state.player_move.toUpperCase()}</div>;
            opponent_hand = <div className="losing">{state.battle_state.opponent_move.toUpperCase()}</div>;
        }else if(state.battle_state.win_lose_tie==="lose"){
            player_hand = <div className="losing">{state.battle_state.player_move.toUpperCase()}</div>;
            opponent_hand = <div className="winning">{state.battle_state.opponent_move.toUpperCase()}</div>;
        }else if(state.battle_state.win_lose_tie==="tie"){
            player_hand = <div className="tieing">{state.battle_state.player_move.toUpperCase()}</div>;
            opponent_hand = <div className="tieing">{state.battle_state.opponent_move.toUpperCase()}</div>;
        }
    }


    return (
        <>
            <div>
                <ThemeToggle></ThemeToggle>
                <Card className="max-w-md ml-auto mr-auto text-l select-none">
                    <CardContent>
                        <div className="space-x-2 mb-4">
                            <div className="animate-pop inline-block text-2xl">Rock!</div>
                            <div className="animate-pop inline-block text-2xl" style={{ animationDelay: "-0.3333s" }}>Paper!</div>
                            <div className="animate-pop inline-block text-2xl" style={{ animationDelay: "-0.6666s" }}>Scissors!</div>
                        </div>
                        <div className="display flex justify-between m-8 text-3xl">
                            {player_hand}
                            {opponent_hand}
                        </div>
                        <div className="space-x-3 h-[5em] flex items-center">
                            {
                                state.battle_state.type === "chant" && <>
                                    <Button
                                        onClick={() => {
                                            sound_rock.play()
                                            state.play_move("rock")
                                        }}
                                        className="text-2xl"
                                    >ROCK!</Button>
                                    <Button
                                        onClick={() => {
                                            sound_paper.play()
                                            state.play_move("paper")
                                        }}
                                        className="text-2xl"
                                    >PAPER!</Button>
                                    <Button
                                        onClick={() => {
                                            sound_scissors.play()
                                            state.play_move("scissors")

                                        }}
                                        className="text-2xl"
                                    >SCISSORS!</Button>
                                </>
                            }
                            {
                                state.battle_state.type==="evaluated" && 
                                <Button
                                    onClick={()=>state.reset()}
                                >Reset</Button>
                            }
                        </div>
                        <div className="flex justify-between">
                            <div>Player {state.score_player}</div>
                            <div>Opponent {state.score_opponent}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    )
}

export default App

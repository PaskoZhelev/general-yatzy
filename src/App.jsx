import { useState, useEffect } from 'react';
import { CATEGORIES, CATEGORY_NAMES, calculateScore, calculateUpperTotal } from './gameLogic';
import { getBotAction } from './botLogic';
import './App.css';

const INITIAL_DICE = [1, 1, 1, 1, 1];
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function App() {
  const [dice, setDice] = useState(INITIAL_DICE);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [rollsLeft, setRollsLeft] = useState(3);
  const [turn, setTurn] = useState('player');
  const [scores, setScores] = useState({ player: {}, bot: {} });
  const [message, setMessage] = useState("Your turn! Roll the dice.");
  
  // New state for the history log
  const [history, setHistory] = useState([]);

  const rollDice = (currentHeld = held) => {
    if (rollsLeft === 0) return;
    setDice(prev => prev.map((d, i) => currentHeld[i] ? d : Math.floor(Math.random() * 6) + 1));
    setRollsLeft(prev => prev - 1);
  };

  const toggleHold = (index) => {
    if (rollsLeft === 3 || turn !== 'player') return;
    const newHeld = [...held];
    newHeld[index] = !newHeld[index];
    setHeld(newHeld);
  };

  const scoreCategory = (category) => {
    if (scores[turn][category] !== undefined || rollsLeft === 3) return;
    
    const points = calculateScore(dice, category, scores[turn]);
    
    // Log the turn to history before wiping the dice
    setHistory(prev => [
      { 
        id: Date.now(), 
        player: turn, 
        category, 
        dice: [...dice], 
        points 
      },
      ...prev // Prepend so newest is at the top
    ]);

    setScores(prev => ({
      ...prev,
      [turn]: { ...prev[turn], [category]: points }
    }));
    
    endTurn();
  };

  const endTurn = () => {
    setHeld([false, false, false, false, false]);
    setRollsLeft(3);
    setDice([1, 1, 1, 1, 1]);
    setTurn(turn === 'player' ? 'bot' : 'player');
    setMessage(turn === 'player' ? "Bot is thinking..." : "Your turn! Roll the dice.");
  };

  useEffect(() => {
    const playBotTurn = async () => {
      if (turn !== 'bot') return;

      if (rollsLeft === 3) {
        await delay(1000);
        rollDice([false, false, false, false, false]);
        return;
      }

      await delay(1000); 
      const decision = getBotAction(dice, scores.bot, rollsLeft);

      if (decision.action === 'hold' && rollsLeft > 0) {
        setMessage(`Bot holds dice...`);
        const newHeld = [false, false, false, false, false];
        decision.holdIndices.forEach(i => newHeld[i] = true);
        setHeld(newHeld);
        
        await delay(1000);
        rollDice(newHeld); 
      } else if (decision.action === 'score' || rollsLeft === 0) {
        const finalDecision = rollsLeft === 0 ? decision : getBotAction(dice, scores.bot, 0);
        setMessage(`Bot scores in ${CATEGORY_NAMES[finalDecision.category]}`);
        await delay(1500);
        scoreCategory(finalDecision.category);
      }
    };

    playBotTurn();
  }, [turn, rollsLeft, dice]);

  const renderCategoryRow = (cat, playerKey) => {
    const isAvailable = scores[playerKey][cat] === undefined;
    const showPreview = turn === playerKey && playerKey === 'player' && rollsLeft < 3;
    
    return (
      <div 
        key={cat} 
        className={`score-row ${isAvailable ? 'open' : 'filled'}`}
        onClick={() => isAvailable && showPreview && scoreCategory(cat)}
      >
        <span>{CATEGORY_NAMES[cat]}</span>
        <span>
          {!isAvailable 
            ? scores[playerKey][cat] 
            : (showPreview ? calculateScore(dice, cat, scores[playerKey]) : '-')}
        </span>
      </div>
    );
  };

  const renderScorecard = (playerKey) => {
    const upper = calculateUpperTotal(scores[playerKey]);
    const total = Object.values(scores[playerKey]).reduce((a, b) => a + b, 0) + upper.bonus;

    const upperCategories = CATEGORIES.slice(0, 6);
    const lowerCategories = CATEGORIES.slice(6);

    return (
      <div className="scorecard">
        <h3>{playerKey.toUpperCase()}</h3>
        
        {upperCategories.map(cat => renderCategoryRow(cat, playerKey))}
        
        <div className="score-row subtotal">
          <span>Upper Sum</span>
          <span style={{ color: upper.sum >= 63 ? 'var(--success-color)' : 'inherit' }}>
            {upper.sum} / 63
          </span>
        </div>

        {lowerCategories.map(cat => renderCategoryRow(cat, playerKey))}
        
        <div className="score-row bonus"><span>Bonus:</span><span>{upper.bonus}</span></div>
        <div className="score-row total"><span>TOTAL:</span><span>{total}</span></div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <div className="header-container">
        <h1>Yatzy: The General</h1>
      </div>
      
      <div className="game-status">{message}</div>
      
      <div className="main-layout">
        {/* LEFT SIDE: Scoreboards */}
        <div className="boards-container">
          {renderScorecard('player')}
          {renderScorecard('bot')}
        </div>

        {/* RIGHT SIDE: Dice, Controls & History */}
        <div className="right-panel">
          
          <div className="controls-container">
            <div className="dice-container">
              {dice.map((d, i) => (
                <div key={i} className={`die ${held[i] ? 'held' : ''}`} onClick={() => toggleHold(i)}>
                  {d}
                </div>
              ))}
            </div>
            
            <button className="roll-btn" onClick={() => rollDice()} disabled={turn !== 'player' || rollsLeft === 0}>
              Roll ({rollsLeft} left)
            </button>
          </div>

          <div className="history-container">
            <h3>Match Log</h3>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="history-empty">No actions yet</div>
              ) : (
                history.map(entry => (
                  <div key={entry.id} className={`history-item ${entry.player}`}>
                    <div className="history-header">
                      <span className="history-player">{entry.player.toUpperCase()}</span>
                      <span className="history-points">{entry.points} pts</span>
                    </div>
                    <div className="history-action">{CATEGORY_NAMES[entry.category]}</div>
                    <div className="history-dice">
                      {entry.dice.map((d, i) => (
                        <span key={i} className="mini-die">{d}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
import { useState } from 'react'
import { 
  DndContext, 
  DragOverlay,
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
  PointerSensor
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Hand } from './Hand'
import { Board } from './Board'
import { Cards } from '../data/Cards'
import type { Card } from '../data/Cards'
import './Match.scss'

export const Match: React.FC = () => {
  // Configure sensors for better DevTools and mobile support
  const pointerSensor = useSensor(PointerSensor, {
    // Unified pointer events work better with DevTools simulation
    activationConstraint: {
      distance: 3,
    },
  })
  
  const mouseSensor = useSensor(MouseSensor, {
    // Very low threshold for DevTools simulation
    activationConstraint: {
      distance: 2,
    },
  })
  
  const touchSensor = useSensor(TouchSensor, {
    // More lenient settings for DevTools simulation and real mobile
    activationConstraint: {
      delay: 50,       // Further reduced for DevTools compatibility
      tolerance: 15,   // Very forgiving movement threshold
    },
  })
  
  const keyboardSensor = useSensor(KeyboardSensor)
  
  // Use pointer sensor first (works best with DevTools), then fallback to others
  const sensors = useSensors(pointerSensor, mouseSensor, touchSensor, keyboardSensor)

  // Sample hands for player and opponent
  const [playerHand, setPlayerHand] = useState<Card[]>([
    Cards[1], // Squall
    Cards[2], // Odin
    Cards[5], // Edea
    Cards[6], // Ifrit
    Cards[8], // Laguna
  ])

  const [opponentHand] = useState<Card[]>([
    Cards[3], // Alexander
    Cards[4], // Angelo
    Cards[7], // Jumbocactuar
  ])

  // Initialize empty 3x3 board
  const [board, setBoard] = useState<(Card | null)[]>(Array(9).fill(null));
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = playerHand.find(c => c.id === active.id);
    setActiveCard(card || null);
    console.log('🚀 Drag started:', card?.name, 'Event:', event); // Enhanced debug log
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('✅ Drag ended:', { active: active?.id, over: over?.id, event }); // Enhanced debug log
    
    if (over && over.id !== undefined) {
      const boardIndex = Number(over.id);
      const cardId = Number(active.id);
      
      // Check if the board position is empty
      if (board[boardIndex] === null) {
        const card = playerHand.find(c => c.id === cardId);
        if (card) {
          // Place card on board
          const newBoard = [...board];
          newBoard[boardIndex] = card;
          setBoard(newBoard);
          
          // Remove card from hand
          setPlayerHand(prev => prev.filter(c => c.id !== cardId));
        }
      }
    }
    
    // Always clear the active card state
    setActiveCard(null);
  };
  
  // Add a drag cancel handler for better cleanup
  const handleDragCancel = () => {
    console.log('❌ Drag cancelled'); // Enhanced debug log
    setActiveCard(null);
  };

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Debug indicator - remove in production */}
      {activeCard && (
        <div style={{ 
          position: 'fixed', 
          top: 10, 
          left: 10, 
          background: 'rgba(74, 158, 255, 0.9)', 
          color: 'white', 
          padding: '8px 15px', 
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 9999,
          border: '2px solid #4a9eff',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}>
          🎯 Dragging: {activeCard.name}
        </div>
      )}
      
      <div className="game-layout">
        <Hand 
          cards={opponentHand} 
          title="Opponent Hand"
          isOpponent={true}
          className="opponent-hand"
        />
        <Board board={board} />
        <Hand 
          cards={playerHand} 
          title="Your Hand"
          isOpponent={false}
          className="player-hand"
        />
      </div>
      
      <DragOverlay>
        {activeCard ? (
          <div className="drag-overlay-card">            <img 
              src={`./images/cards/${activeCard.blueImagePath}`}
              alt={activeCard.name}
              className="drag-overlay-image"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

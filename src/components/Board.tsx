import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Card } from '../data/Cards';
import './Board.scss';

interface DroppableCellProps {
  index: number;
  card: Card | null;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ index, card }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: index,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`board-cell ${card ? 'occupied' : 'empty'} ${isOver ? 'drop-target' : ''}`}
    >
      {card ? (
        <div className="board-card">          <img 
            src={`./images/cards/${card.blueImagePath}`} 
            alt={card.name}
            className="board-card-image"
          />
        </div>
      ) : (
        <div className="empty-slot">
          <span className="empty-text">+</span>
        </div>
      )}
    </div>
  );
};

interface BoardProps {
  board: (Card | null)[];
}

export const Board = ({ board }: BoardProps) => {
  return (
    <div className="board">
      <div className="board-grid">
        {board.map((card, index) => (
          <DroppableCell 
            key={index}
            index={index}
            card={card}
          />
        ))}
      </div>
    </div>
  );
};

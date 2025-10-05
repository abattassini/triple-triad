import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { LocalCard } from '../services/api';
import './Board.scss';

interface DroppableCellProps {
  index: number;
  card: (LocalCard & { owner?: string }) | null;
  currentUsername?: string;
}

const DroppableCell: React.FC<DroppableCellProps> = ({ index, card, currentUsername }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: index,
  });

  // Determine if this card belongs to the opponent
  const isOpponentCard = card?.owner && currentUsername && card.owner !== currentUsername;
  const imagePath = isOpponentCard ? card.redImagePath : card?.blueImagePath;

  // Debug logging
  if (card) {
    console.log(`🖼️ Board cell ${index}:`, {
      cardName: card.name,
      owner: card.owner,
      currentUsername,
      isOpponentCard,
      blueImagePath: card.blueImagePath,
      redImagePath: card.redImagePath,
      selectedImagePath: imagePath,
    });
  }
  return (
    <div
      ref={setNodeRef}
      className={`board-cell ${card ? 'occupied' : 'empty'} ${isOver ? 'drop-target' : ''}`}
    >
      {card ? (
        <div className="board-card">
          {' '}
          <img
            src={`/triple-triad/images/cards/${imagePath}`}
            alt={card.name}
            className="board-card-image"
            onError={e => {
              // Fallback to blue image if red image doesn't exist
              if (isOpponentCard && imagePath !== card.blueImagePath) {
                console.warn(`⚠️ Red image not found for ${card.name}, falling back to blue`);
                e.currentTarget.src = `/triple-triad/images/cards/${card.blueImagePath}`;
              }
            }}
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
  board: ((LocalCard & { owner?: string }) | null)[];
  currentUsername?: string;
}

export const Board = ({ board, currentUsername }: BoardProps) => {
  return (
    <div className="board">
      <div className="board-grid">
        {board.map((card, index) => (
          <DroppableCell key={index} index={index} card={card} currentUsername={currentUsername} />
        ))}
      </div>
    </div>
  );
};

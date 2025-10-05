import React from 'react';
import type { LocalCard } from '../services/api';
import { DraggableCard } from './DraggableCard';
import './Hand.scss';

interface HandProps {
  cards: LocalCard[];
  title?: string;
  isOpponent?: boolean;
  className?: string;
  isMyTurn?: boolean;
}

export const Hand: React.FC<HandProps> = ({
  cards,
  title = 'Your Hand',
  isOpponent = false,
  className = '',
  isMyTurn = true,
}) => {
  return (
    <div className={`hand ${className} ${isOpponent ? 'hand--opponent' : 'hand--player'}`}>
      <h3 className="hand-title">{title}</h3>
      <div className="hand-cards">
        {cards.map((card, index) => (
          <DraggableCard
            key={`${card.id}-${index}`}
            card={card}
            isDraggable={!isOpponent && isMyTurn}
          />
        ))}
      </div>
    </div>
  );
};

import React from 'react';
import type { LocalCard } from '../services/api';
import { DraggableCard } from './DraggableCard';
import './Hand.scss';

interface HandProps {
  cards: LocalCard[];
  /**
   * The line above the cards. A node rather than a string because the opponent's name is a control on the match page
   * (it opens their profile panel, PLAN-020) while the score beside it is not — see `Match.tsx`, which composes both.
   * Everything this component does with it is put it in an `h3`, so a plain string still works everywhere.
   */
  title?: React.ReactNode;
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

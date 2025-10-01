import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Card } from '../data/Cards';
import './DraggableCard.scss';

interface DraggableCardProps {
  card: Card;
  isDraggable?: boolean;
}

export const DraggableCard: React.FC<DraggableCardProps> = ({ card, isDraggable = true }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !isDraggable,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;  return (
    <div 
      ref={isDraggable ? setNodeRef : undefined}
      style={style}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      className={`card ${isDragging ? 'dragging' : ''} ${!isDraggable ? 'card--opponent' : ''}`}
    >      <img 
        src={`./images/cards/${card.blueImagePath}`}
        alt={card.name}
        className="card-image"
      />
    </div>
  );
};

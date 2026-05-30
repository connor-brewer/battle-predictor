import type { Pokemon } from '../../types/pokemon';
import { MovesGrid } from '../MovesGrid/MovesGrid';
import styles from './PokemonCard.module.css';

interface PokemonCardProps {
  pokemon: Pokemon;
  side: 'left' | 'right';
}

export function PokemonCard({ pokemon, side }: PokemonCardProps) {
  return (
    <div className={`${styles.card} ${styles[side]}`}>
      <h2 className={styles.name}>{pokemon.pokemonName}</h2>
      <img
        className={styles.sprite}
        src={pokemon.spriteUrl}
        alt={pokemon.pokemonName}
      />
      <MovesGrid moves={pokemon.moves} />
    </div>
  );
}

import type { Move, Pokemon, PokemonType, UserInfo } from '../types/pokemon';

// IDs here intentionally match src/python/query_builder.py:TYPE_MAP so that
// when the backend HTTP layer is wired up, TypeIDs flowing through the
// frontend already match what the backend stores in the database.
export const TYPES: Record<string, PokemonType> = {
  normal:   { typeId: 1,     typeName: 'Normal' },
  fighting: { typeId: 2,     typeName: 'Fighting' },
  flying:   { typeId: 3,     typeName: 'Flying' },
  poison:   { typeId: 4,     typeName: 'Poison' },
  ground:   { typeId: 5,     typeName: 'Ground' },
  rock:     { typeId: 6,     typeName: 'Rock' },
  bug:      { typeId: 7,     typeName: 'Bug' },
  ghost:    { typeId: 8,     typeName: 'Ghost' },
  steel:    { typeId: 9,     typeName: 'Steel' },
  fire:     { typeId: 10,    typeName: 'Fire' },
  water:    { typeId: 11,    typeName: 'Water' },
  grass:    { typeId: 12,    typeName: 'Grass' },
  electric: { typeId: 13,    typeName: 'Electric' },
  psychic:  { typeId: 14,    typeName: 'Psychic' },
  ice:      { typeId: 15,    typeName: 'Ice' },
  dragon:   { typeId: 16,    typeName: 'Dragon' },
  dark:     { typeId: 17,    typeName: 'Dark' },
  fairy:    { typeId: 18,    typeName: 'Fairy' },
  stellar:  { typeId: 19,    typeName: 'Stellar' },
  unknown:  { typeId: 10001, typeName: 'Unknown' },
};

// Hand-rolled handful of moves keyed by name. The backend will return the
// real LearnSet rows; this is just enough to fill four move buttons per side.
const MOVES: Record<string, Move> = {
  hydroPump:   { moveId: 1, moveName: 'Hydro Pump',   type: TYPES.water,    power: 110, accuracy: 80 },
  bubbleBeam:  { moveId: 2, moveName: 'Bubble Beam',  type: TYPES.water,    power: 65,  accuracy: 100 },
  tailWhip:    { moveId: 3, moveName: 'Tail Whip',    type: TYPES.normal,   power: null, accuracy: 100 },
  headbutt:    { moveId: 4, moveName: 'Headbutt',     type: TYPES.normal,   power: 70,  accuracy: 100 },
  leafStorm:   { moveId: 5, moveName: 'Leaf Storm',   type: TYPES.grass,    power: 130, accuracy: 90 },
  stomp:       { moveId: 6, moveName: 'Stomp',        type: TYPES.normal,   power: 65,  accuracy: 100 },
  leer:        { moveId: 7, moveName: 'Leer',         type: TYPES.normal,   power: null, accuracy: 100 },
  gust:        { moveId: 8, moveName: 'Gust',         type: TYPES.flying,   power: 40,  accuracy: 100 },
  flamethrower:{ moveId: 9, moveName: 'Flamethrower', type: TYPES.fire,     power: 90,  accuracy: 100 },
  thunderbolt: { moveId: 10,moveName: 'Thunderbolt',  type: TYPES.electric, power: 90,  accuracy: 100 },
  iceBeam:     { moveId: 11,moveName: 'Ice Beam',     type: TYPES.ice,      power: 90,  accuracy: 100 },
  earthquake:  { moveId: 12,moveName: 'Earthquake',   type: TYPES.ground,   power: 100, accuracy: 100 },
};

// Sprite URLs use the public PokeAPI sprite CDN — fine for local dev. The
// backend can swap to its own URLs later without touching the components.
const sprite = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

export const MOCK_POKEMON: Pokemon[] = [
  {
    pokemonId: 9,
    pokemonName: 'Blastoise',
    height: 16,
    weight: 855,
    hp: 79,
    attack: 83,
    defense: 100,
    specialAttack: 85,
    specialDefense: 105,
    speed: 78,
    types: [TYPES.water],
    spriteUrl: sprite(9),
    moves: [MOVES.hydroPump, MOVES.tailWhip, MOVES.headbutt, MOVES.bubbleBeam],
  },
  {
    pokemonId: 357,
    pokemonName: 'Tropius',
    height: 20,
    weight: 1000,
    hp: 99,
    attack: 68,
    defense: 83,
    specialAttack: 72,
    specialDefense: 87,
    speed: 51,
    types: [TYPES.grass, TYPES.flying],
    spriteUrl: sprite(357),
    moves: [MOVES.leafStorm, MOVES.stomp, MOVES.leer, MOVES.gust],
  },
  {
    pokemonId: 6,
    pokemonName: 'Charizard',
    height: 17,
    weight: 905,
    hp: 78,
    attack: 84,
    defense: 78,
    specialAttack: 109,
    specialDefense: 85,
    speed: 100,
    types: [TYPES.fire, TYPES.flying],
    spriteUrl: sprite(6),
    moves: [MOVES.flamethrower, MOVES.gust, MOVES.headbutt, MOVES.leer],
  },
  {
    pokemonId: 25,
    pokemonName: 'Pikachu',
    height: 4,
    weight: 60,
    hp: 35,
    attack: 55,
    defense: 40,
    specialAttack: 50,
    specialDefense: 50,
    speed: 90,
    types: [TYPES.electric],
    spriteUrl: sprite(25),
    moves: [MOVES.thunderbolt, MOVES.tailWhip, MOVES.headbutt, MOVES.iceBeam],
  },
  {
    pokemonId: 95,
    pokemonName: 'Onix',
    height: 88,
    weight: 2100,
    hp: 35,
    attack: 45,
    defense: 160,
    specialAttack: 30,
    specialDefense: 45,
    speed: 70,
    types: [TYPES.rock, TYPES.ground],
    spriteUrl: sprite(95),
    moves: [MOVES.earthquake, MOVES.headbutt, MOVES.tailWhip, MOVES.stomp],
  },
];

export const MOCK_USER: UserInfo = {
  userId: 1,
  username: 'Trainer',
  totalPoints: 253,
  correctPredictions: 12,
  incorrectPredictions: 8,
};

import playerPool from './players.json'

// Portraits are positioned from the supplied Project Rio player/icon screenshots.
// Keep the names alongside each sheet so future roster changes cannot shift portraits.
const sheets = [
  ['IMG_7121.jpeg', 740, 699, 685, 136, ['Mario', 'Luigi', 'Donkey Kong', 'Diddy Kong', 'Peach', 'Daisy', 'Yoshi']],
  ['IMG_7122.jpeg', 722, 836, 677, 276, ['Baby Mario', 'Baby Luigi', 'Bowser', 'Wario', 'Waluigi', 'Green Koopa', 'Red Toad']],
  ['IMG_7123.jpeg', 724, 1201, 680, 287, ['Boo', 'Toadette', 'Shy Guy', 'Birdo', 'Monty Mole', 'Bowser Jr.', 'Red Paratroopa', 'Blue Pianta', 'Red Pianta', 'Yellow Pianta', 'Blue Noki']],
  ['IMG_7124.jpeg', 735, 1166, 690, 256, ['Red Noki', 'Green Noki', 'Hammer Bro', 'Toadsworth', 'Blue Toad', 'Yellow Toad', 'Green Toad', 'Purple Toad', 'Blue Magikoopa', 'Red Magikoopa', 'Green Magikoopa']],
  ['IMG_7125.jpeg', 736, 1189, 691, 275, ['Yellow Magikoopa', 'King Boo', 'Petey Piranha', 'Dixie Kong', 'Goomba', 'Paragoomba', 'Red Koopa', 'Green Paratroopa', 'Blue Shy Guy', 'Yellow Shy Guy', 'Green Shy Guy']],
  ['IMG_7126.jpeg', 728, 1186, 683, 273, ['Gray Shy Guy', 'Dry Bones', 'Green Dry Bones', 'Dark Bones', 'Blue Dry Bones', 'Fire Bro', 'Boomerang Bro', 'Wiggler', 'Blooper', 'Funky Kong', 'Tiny Kong']],
  ['IMG_7127.jpeg', 733, 1189, 688, 278, ['Kritter', 'Blue Kritter', 'Red Kritter', 'Brown Kritter', 'King K Rool', 'Baby Peach', 'Baby Daisy', 'Baby DK', 'Red Yoshi', 'Blue Yoshi', 'Yellow Yoshi']],
  ['IMG_7128.jpeg', 735, 1182, 688, 264, ['Light Blue Yoshi', 'Pink Yoshi', 'Cap', 'Pauline', 'Burger King', 'Harley Quinn', 'Red', 'Roshi', 'Inkling', 'He-Man', 'Nigel Thornberry']],
  ['IMG_7129.jpeg', 734, 1162, 684, 245, ['Sophie', 'Ronald McDonald', 'Sadie Adler', 'Narf', 'Jade Harley', 'Shaggy', 'Brock', 'Buttercup', 'John Cena', 'Isabelle', 'Flowey']],
  ['IMG_7130.jpeg', 737, 1162, 686, 245, ['Sheen Estevez', 'Samus', 'Jack Black', 'Bubbles', 'PANCAKE!?!', 'Comet', 'Rosalina', 'Sans', 'Wendy', 'Saul Goodman', 'Blossom']],
  ['IMG_7131.jpeg', 739, 1168, 688, 251, ['Timmy Turner', 'Paula', 'Coach', 'Zelda', 'Grimace', 'Scooby Doo', 'Mr. Bean', 'Goombella', 'Steve Harvey', 'Walter White', 'Hatsune Miku']],
  ['IMG_7132.jpeg', 741, 1171, 687, 262, ['Mike', 'Cynthia', 'Masahiro Sakurai', 'Mona Lisa', 'Ada Wong', 'Garfield', 'Misty', 'Waffle', 'Derrick White', 'Sonya Blade', 'Cammy White']],
  ['IMG_7133.jpeg', 747, 1182, 695, 266, ['Cortana', 'OAO', 'juhg,koop', 'William Afton', 'Juri Han', 'Cranky Kong', 'Squirrel Girl', 'Horse', 'Josh Block', 'Wrinkly Kong', 'Mario Judah']],
  ['IMG_7134.jpeg', 746, 491, 689, 263, ['Chica', 'Rose', 'Amelia Earhart']],
]

const portraits = new Map(sheets.flatMap(([file, width, height, x, firstY, names]) =>
  names.map((name, index) => [name, { file, width, height, x, y: firstY + index * 87 }])))

const playersById = new Map(playerPool.map(player => [player.id, player]))
export function playerPortraitStyle(player, size) {
  const identity = playersById.get(player.id) || player
  if (identity.portrait) return {
    backgroundImage: `url(${import.meta.env.BASE_URL}${identity.portrait})`,
    backgroundSize: `${480 * size / 51}px ${561 * size / 51}px`,
    backgroundPosition: `${(size - 48 * size / 51) / 2 - identity.portraitIndex % 10 * 48 * size / 51}px ${-Math.floor(identity.portraitIndex / 10) * size}px`,
    backgroundRepeat: 'no-repeat',
  }
  const portrait = portraits.get(identity.portraitName || identity.name)
  if (!portrait) return null
  const scale = size / 76
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}icons/${portrait.file})`,
    backgroundSize: `${portrait.width * scale}px ${portrait.height * scale}px`,
    backgroundPosition: `${size / 2 - portrait.x * scale}px ${size / 2 - portrait.y * scale}px`,
  }
}

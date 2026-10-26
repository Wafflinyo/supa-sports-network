// All 92 badge pictograms have distinct SVG mark+flourish combinations.
export const signatureMarks=[
  'M0-10L3-3 11-2 5 3 7 11 0 7-7 11-5 3-11-2-3-3Z', // star
  'M4-12L-7 1H-1L-5 12 10-3H3Z', // lightning
  'M-10-5H4M0-10L10-5 0 0M10 6H-4M0 1L-10 6 0 11', // arrows
  'M0-12L11 0 0 12-11 0Z M0-12V12M-11 0H11', // diamond
  'M0-12V12M-12 0H12M-8-8L8 8M8-8L-8 8', // spark
  'M7-11A12 12 0 1 0 7 11A9 9 0 0 1 7-11Z', // moon
  'M-9 12V-12M-9-12Q0-17 9-10V4Q0-3-9 4', // flag
  'M0-12L10-8V3Q8 10 0 13Q-8 10-10 3V-8Z M-5 1L-1 5 6-4', // shield
  'M-12 0Q0-13 12 0Q0 13-12 0Z M-4 0A4 4 0 1 0 4 0A4 4 0 1 0-4 0', // eye
  'M-11 0A11 11 0 1 0 11 0A11 11 0 1 0-11 0M-6 0A6 6 0 1 0 6 0A6 6 0 1 0-6 0M-14 0H14M0-14V14', // target
  'M-4-12H4L5-8 9-6 12-2 8 2 9 6 5 8 4 12H-4L-5 8-9 6-12 2-8-2-9-6-5-8Z M-4 0A4 4 0 1 0 4 0A4 4 0 1 0-4 0', // gear
  'M-6 12L-3-1 1-10Q9-1 5 5L4 12Z M-6 12H9M-9-4L-4-8M8-9L12-5', // torch
  'M-8-6L-4-12H5L11-5 9 4 0 12-10 4Z M-8-6L0 12 11-5M-10 4L9 4', // gem
  'M0-12V-6M0 6V12M-12 0H-6M6 0H12M-9-9L-5-5M5 5L9 9M9-9L5-5M-5 5L-9 9 M-4-4A6 6 0 1 0 4 4A6 6 0 1 0-4-4', // sun
  'M-10 10Q-11-9 8-12Q5-4-2 0Q7 0 10-8Q12 12-10 10Z M-5 9L6-7', // feather
  'M-11-4Q-4-13 7-7Q14-1 4 7Q-6 14-10 6Q-14-1-3-3Q5-5 8 2', // swirl
];
export const flourishMarks=[
  'M-35 15Q-40-12-28-25M35 15Q40-12 28-25M-33 2L-39-3M33 2L39-3',
  'M-33-16L-21-27M-35 1L-22-11M-31 18L-19 7M33-16L21-27M35 1L22-11M31 18L19 7',
  'M-38-20L-22-4M-39-5L-23 11M22-11L38 5M22 4L38 20',
  'M-36 8Q-20-39 16-28Q40-21 36 8M-34 16Q-14 37 13 27',
  'M-35 18Q-46 1-30-18M35 18Q46 1 30-18M-34 6L-43 2M34 6L43 2M-30-6L-38-13M30-6L38-13',
  'M-34-15L-20-28 0-30 20-28 34-15M-34 16L-21 28 0 31 21 28 34 16M-38 0H-27M27 0H38',
];
export const badgeArtSignature = badge => {
  const serial=Number(badge.serial);
  return `${(serial-1)%signatureMarks.length}:${Math.floor((serial-1)/signatureMarks.length)}`;
};

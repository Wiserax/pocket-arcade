const paths = {
  play: '<path d="M22 14 48 32 22 50Z" fill="#fff5bd"/>',
  home: '<path d="m8 30 24-20 24 20-5 1v23H13V31Z" fill="#e3b773"/><path d="M27 54V35h12v19" fill="#705641"/>',
  gear: '<path d="m25 7 14 0 3 9 9 3 6 12-6 7-1 11-13 7-8-6-11-1-7-13 6-8 0-11Z" fill="#a4c9d7"/><circle cx="32" cy="32" r="10" fill="#425a70"/>',
  coin: '<circle cx="32" cy="34" r="25" fill="#b6792e"/><circle cx="32" cy="29" r="24" fill="#ffd950"/><circle cx="32" cy="29" r="17" fill="#f6b934" stroke="#fff49e"/><path d="m32 15 4 9 10 5-10 4-4 10-5-10-9-4 9-5Z" fill="#fff0a0" stroke="none"/>',
  star: '<path d="m32 6 8 17 19 3-14 14 3 19-16-9-17 9 3-19L5 26l19-3Z" fill="#ffdb58"/>',
  trophy:
    '<path d="M18 10h28v20c0 12-28 12-28 0Z" fill="#ffcf51"/><path d="M18 15H7v9c0 9 9 10 14 10M46 15h11v9c0 9-9 10-14 10M32 39v13M22 55h20" fill="none" stroke="#ffcf51" stroke-width="6"/>',
  box: '<path d="m8 18 24-10 24 10v31L32 58 8 49Z" fill="#ca9253"/><path d="m8 18 24 11 24-11M32 29v29" fill="none"/><path d="m22 12 23 11v14l-9 4V27L13 17" fill="#ffe39c"/>',
  heart:
    '<path d="M32 55S4 38 7 21c3-16 21-16 25-4 6-12 23-12 26 4 3 17-26 34-26 34Z" fill="#ff7c82"/>',
  shield:
    '<path d="m10 13 22-7 22 7-3 25-19 20-19-20Z" fill="#8ed281"/><path d="M32 14v34M17 28h30" stroke="#ecffc7" stroke-width="5"/>',
  spark:
    '<path d="m31 6 7 17 19 8-19 7-7 20-8-20-18-7 18-8Z" fill="#b4e6f0"/><path d="m50 4 3 7 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#ffe997"/>',
  eye: '<path d="M5 32S15 16 32 16s27 16 27 16-10 16-27 16S5 32 5 32Z" fill="#e0f5dd"/><circle cx="32" cy="32" r="11" fill="#69bacc"/><circle cx="32" cy="32" r="5" fill="#26394a"/>',
  pause: '<path d="M19 13h9v38h-9ZM37 13h9v38h-9Z" fill="#fff3c9"/>',
  back: '<path d="m39 12-20 20 20 20" fill="none" stroke="#fff0c0" stroke-width="9"/>',
  sound:
    '<path d="M9 25h11l15-12v38L20 39H9Z" fill="#f8d78e"/><path d="M43 22q14 10 0 20M48 14q25 18 0 36" fill="none" stroke="#a8d7e8" stroke-width="4"/>',
  calendar:
    '<rect x="9" y="14" width="46" height="42" rx="7" fill="#dce7d5"/><path d="M9 28h46M21 8v14M43 8v14" stroke="#e4985f" stroke-width="7"/><path d="m22 41 7 7 15-15" stroke="#599d82" stroke-width="5" fill="none"/>',
};
export function icon(name, size = 26) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="#26313d" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.spark}</svg>`;
}

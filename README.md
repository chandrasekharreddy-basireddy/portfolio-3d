# Chandra Sekhar Reddy - 3D Walking Portfolio

A 3D portfolio world built with Three.js. Scroll to walk a character along a
trail through six information boards, with four switchable seasons, weather,
ambient sound, animals and other people.

## Live site

Hosted on GitHub Pages at:
https://chandrasekharreddy-basireddy.github.io/portfolio-3d/

## How to view locally

Serve this folder with any static server (for example
`python3 -m http.server`) and open the page in a modern browser. Opening
index.html directly from disk also works if you keep the folder structure.

## How it works

- index.html, css/ and js/ hold the interface and the game code.
- models/ holds the retargeted character animation clips.
- assets/ holds the profile photo and favicon.
- The Three.js library, the character and the animal models load from public
  CDNs (cdnjs, jsDelivr, raw.githubusercontent) so the repository stays small.

## Credits

Built by Chandra Sekhar Reddy with Three.js. The walker, friend and angler
characters are custom-built for this portfolio (the walker wears the owner's
real face), animated with clips retargeted from the Three.js Soldier mocap
set. The fox, horse and flamingos come from the glTF sample libraries. The
Iron Man armor, wolf (with its walk cycle), peacock, toucan, bird, spider
monkey and anemone flower models are personal asset packs, and the fall road
with its autumn birches was extracted from a personal Blender scene.

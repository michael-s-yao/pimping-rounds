# Pimping Rounds

[![LICENSE](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE.md)
[![CONTACT](https://img.shields.io/badge/contact-hello%40michaelsyao.com-blue)](mailto:hello@michaelsyao.com)

**Pimping Rounds** is a medical education game that draws inspiration from Wordle. The core mechanic involves guessing a secret daily medical diagnosis — after each guess, the game ranks how semantically close your answer is to the target using [PubMedBERT](https://huggingface.co/NeuML/pubmedbert-base-embeddings) embeddings, helping you zero in on the answer one clue at a time.

## Playing

Visit [pimpingrounds.com](https://pimpingrounds.com/) to play. A new target term is selected for each clerkship category every day.

## Project Structure

```
pimping-rounds/
├── index.html                  # Single-page application entry point
├── cookie-policy.html          # Cookie policy page
├── public/
│   ├── css/
│   │   ├── index.css           # Base layout and typography
│   │   ├── game.css            # Game board and guess list styling
│   │   ├── menu.css            # Sidebar and category menu styling
│   │   ├── mobile.css          # Responsive mobile overrides
│   │   └── cookies.css         # Cookie consent banner styling
│   ├── js/
│   │   ├── game.js             # Core game logic, state, and rendering
│   │   └── embeddings.js       # Embedding loader and cosine similarity API
│   ├── terms.json              # Medical terms with clerkship category tags
│   └── embeddings.json         # Pre-built PubMedBERT term embeddings
└── scripts/
    └── generate_embeddings.py  # Builds embeddings.json from terms.json
```

## Embeddings

Term embeddings are generated offline using the [`NeuML/pubmedbert-base-embeddings`](https://huggingface.co/NeuML/pubmedbert-base-embeddings) model via the `scripts/generate_embeddings.py` script. To regenerate the embeddings after editing `public/terms.json`, install the dependencies and run:

```bash
pip install numpy sentence-transformers
cd public && python ../scripts/generate_embeddings.py
```

The script reads `public/terms.json`, encodes each term with PubMedBERT, and writes the resulting float32 vectors (base64-encoded) to `public/embeddings.json`.

## Contributing

New medical terms and categories are welcome. To propose a term, open a GitHub issue or submit a pull request editing `public/terms.json`. Each entry follows the format:

```json
{ "term": "Term Name", "categories": ["internal_medicine", "emergency_medicine"] }
```

Supported categories: `emergency_medicine`, `family_medicine`, `internal_medicine`, `neurology`, `obgyn`, `pediatrics`, `psychiatry`, `surgery`.

## License

This project is distributed under the [MIT License](LICENSE).

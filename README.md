# Wind Rhythm - React + TypeScript + Vite + Materialize

This project is set up with Vite and React (TypeScript) and styled using Materialize CSS.

## Getting Started

1. Install dependencies:
   - npm install
2. Run the dev server:
   - npm run dev
3. Build for production:
   - npm run build
4. Preview the production build:
   - npm run preview

## UI Framework

- Materialize CSS is added via npm package `materialize-css` and imported in `src/main.tsx`.
- Google Material Icons are linked in `index.html`.

## Structure

- `src/App.tsx` provides a basic single-page template with a Materialize Navbar, content sections, and Footer.
- You can extend it by adding React Router for real client-side navigation and more pages/components.

## Notes

- If you use Materialize JS components (like modals or sidenav), initialize them in a `useEffect`. Types can be handled by declaring the `M` global or using dynamic imports.

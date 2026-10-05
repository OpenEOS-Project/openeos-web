# Logos der Integrationen

Eine Datei je Anbieter, am besten benannt nach dessen `id` in
`src/config/integrations.ts` (`sumup.svg`, `stripe.svg`, `fiskaly.svg`).
Nach dem Ablegen den Pfad im Katalogeintrag als `logo` eintragen, z. B.
`logo: '/integrations/sumup.svg'`.

Ohne `logo` zeigt die Karte den Anfangsbuchstaben auf der Hausfarbe des
Anbieters — die Seite bleibt also auch ohne Logos vollständig, und es
wird keine Datei auf Verdacht angefragt.

Bitte die offiziellen SVGs der Anbieter aus deren Presse- oder
Markenbereich verwenden und nichts nachzeichnen: ein ungenaues
Markenzeichen ist schlechter als keines. Quadratisch oder annähernd
quadratisch passt am besten, die Karte zeigt sie in 36 × 36 px.

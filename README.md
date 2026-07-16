# Driving Simulator

A relaxing browser game with one goal: drive around a map.

Top-down city built with plain HTML, CSS, and JavaScript on a `<canvas>` — no
dependencies, no build step. Just open `index.html`.

## Play

Open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `← →` | Steer |
| `Space` | Handbrake (leaves skid marks) |
| `H` | Horn |
| `C` | Toggle camera zoom |
| `R` | Respawn at start |

On touch devices, on-screen buttons appear automatically.

## Features

- Momentum-based car physics (bicycle steering model, engine braking, reverse)
- Procedurally laid-out city: roads, lane markings, crosswalks, buildings,
  parks, lakes, and trees
- Smooth follow-camera that looks ahead and zooms with speed
- Live speedometer, gear indicator, pedal readout, and a minimap
- Tire skid marks and a subtle engine-hum + horn via the Web Audio API

The whole point is just to cruise around. Enjoy the drive.

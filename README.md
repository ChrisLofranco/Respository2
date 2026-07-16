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
| `M` | Mute / unmute |
| `R` | Respawn at start |

On touch devices, on-screen buttons appear automatically.

## Features

- Momentum-based car physics (bicycle steering model, engine braking, reverse)
- Procedurally laid-out city: roads, lane markings, crosswalks, buildings,
  parks, lakes, and trees
- **AI traffic** that drives the road grid, keeps its lane, yields, and doesn't
  rear-end (you can bump into it, too)
- **Lap timer & checkpoints** — follow the glowing gates around a circuit to set
  a lap time; best lap and lap count are tracked, with an on-screen arrow and
  minimap markers guiding you to the next gate
- **Car colour picker** — nine colours to choose from
- Smooth follow-camera that looks ahead and zooms with speed
- Live speedometer, gear indicator, pedal readout, and a minimap
- Tire skid marks and layered **Web Audio** sound: engine hum, horn, tyre
  screech, checkpoint chime, lap-complete jingle, and collision thud (mutable)

The whole point is just to cruise around. Enjoy the drive.

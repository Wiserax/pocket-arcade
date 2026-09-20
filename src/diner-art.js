import { rr, circle, line, poly, star } from "./draw.js";
// Wall scenery stays behind the high-contrast order bubbles and patience bars.
export function dinerScenery(c, theme, time) {
  const colors = [
    "#7caa7b",
    "#56517f",
    "#986c57",
    "#9cc9d3",
    "#5b979e",
    "#926176",
  ];
  rr(c, 20, 116, 380, 67, 6, colors[theme], null);
  line(
    c,
    [
      [22, 183],
      [398, 183],
    ],
    "#76573f",
    5,
  );
  if (theme === 0) {
    for (const x of [30, 386]) {
      line(
        c,
        [
          [x, 118],
          [x - 3, 140],
          [x + 3, 172],
        ],
        "#4e7350",
        3,
      );
      for (let i = 0; i < 4; i++) {
        circle(
          c,
          x + (i % 2 ? 7 : -5),
          124 + i * 14,
          7,
          "#b0ce75",
          "#5d8c52",
          1,
        );
      }
    }
    for (const x of [126, 290]) {
      rr(c, x - 32, 124, 64, 50, 6, "#b9e0cc", "#e3d5a1", 4);
      poly(
        c,
        [
          [x - 31, 163],
          [x - 8, 140],
          [x + 10, 161],
          [x + 31, 143],
          [x + 31, 173],
          [x - 31, 173],
        ],
        "#6d9a71",
        null,
      );
      line(
        c,
        [
          [x, 125],
          [x, 173],
        ],
        "#e6d8af",
        3,
      );
    }
  } else if (theme === 1) {
    rr(c, 107, 122, 206, 53, 9, "#373b69", "#b9aacb", 3);
    circle(c, 213, 141, 14, "#f9e6b1", null);
    circle(c, 220, 136, 13, "#373b69", null);
    for (let i = 0; i < 8; i++) {
      const x = 120 + i * 25,
        y = 133 + (i % 3) * 12;
      star(c, x, y, 3 + Math.sin(time + i) * 0.5, "#e6d5a3");
    }
  } else if (theme === 2) {
    for (let row = 0; row < 3; row++)
      for (let x = 24 - (row % 2) * 15; x < 390; x += 32)
        rr(c, x, 120 + row * 20, 29, 17, 3, "#ba8866", "#8b604d", 1);
    rr(c, 167, 120, 86, 61, 25, "#62443d", "#dbb085", 5);
    rr(c, 177, 131, 66, 48, 20, "#3a343c", null);
    for (let i = 0; i < 5; i++)
      poly(
        c,
        [
          [183 + i * 11, 175],
          [188 + i * 11, 142 + Math.sin(time * 5 + i) * 8],
          [194 + i * 11, 175],
        ],
        i % 2 ? "#ffcc65" : "#e99253",
        null,
      );
  } else if (theme === 3) {
    for (const x of [104, 210, 316]) {
      rr(c, x - 38, 122, 76, 54, 25, "#7bb4d0", "#e5e6ca", 3);
      for (let i = 0; i < 3; i++)
        circle(c, x - 15 + i * 14, 158 - (i % 2) * 7, 13, "#e7f0db", null);
      line(
        c,
        [
          [x, 124],
          [x, 175],
        ],
        "#f1e6c9",
        3,
      );
    }
  } else if (theme === 4) {
    for (const x of [112, 306]) {
      circle(c, x, 148, 26, "#bddacf", "#cda575", 5);
      c.save();
      c.beginPath();
      c.arc(x, 148, 21, 0, 7);
      c.clip();
      for (let i = 0; i < 4; i++)
        line(
          c,
          [
            [x - 26, 153 + i * 7],
            [x - 8, 150 + i * 7],
            [x + 10, 154 + i * 7],
            [x + 29, 150 + i * 7],
          ],
          i % 2 ? "#509cbb" : "#6cb9c5",
          5,
        );
      c.restore();
    }
    circle(c, 210, 132, 6, "#0000", "#d6cfac", 3);
    line(
      c,
      [
        [210, 138],
        [210, 166],
        [192, 156],
        [188, 145],
      ],
      "#d6cfac",
      4,
    );
    line(
      c,
      [
        [210, 166],
        [228, 156],
        [232, 145],
      ],
      "#d6cfac",
      4,
    );
  } else {
    for (const x of [34, 111, 308, 385]) {
      poly(
        c,
        [
          [x - 13, 119],
          [x + 13, 119],
          [x + 17, 176],
          [x - 17, 176],
        ],
        "#ae5c6b",
        "#79485d",
        2,
      );
      line(
        c,
        [
          [x - 9, 152],
          [x + 10, 152],
        ],
        "#e6c779",
        3,
      );
    }
    line(
      c,
      [
        [210, 116],
        [210, 140],
      ],
      "#e8ca7a",
      3,
    );
    line(
      c,
      [
        [175, 143],
        [185, 153],
        [235, 153],
        [245, 143],
      ],
      "#e8ca7a",
      3,
    );
    for (const x of [180, 210, 240]) {
      rr(c, x - 3, 134, 6, 13, 1, "#f6e5bc", null);
      circle(c, x, 132 + Math.sin(time * 3 + x) * 0.5, 3, "#ffcd69", null);
    }
  }
}

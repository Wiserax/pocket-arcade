// Short, rule-specific advice. This never changes a run or its rewards.
export function nextTry(id, s) {
  switch (id) {
    case "factory":
      if (s.guns.every((g) => g.type === 0))
        return "Try a Mortar for crowds or Frost for a crowded lane. A refit keeps that gun’s upgrade level.";
      if (s.furnace < 2)
        return "Bigger guns still need shells. Improve the furnace, then redirect supply toward the busier lane.";
      return "Watch the magazines: an empty gun cannot fire. Use Overdrive during a surge and focus ranged saboteurs.";
    case "train":
      if (s.wagons.filter((v) => [0, 4, 5].includes(v)).length < 2)
        return "Try a second weapon wagon. Cargo earns more salvage, but it gives up a slot that could protect the train.";
      return "Switch away from marked rails before the strike. Save Steam surge for a tight escape; refit at each station.";
    case "mech":
      if (s.parts.filter((p) => p > 0 && p < 4).length < 2)
        return "Try a second weapon before launch. Batteries supply extra power; fitting another Armor plate also slows your escape.";
      return "Keep moving across open space. Dash through danger, then use the next refit to change a weapon that isn’t working.";
    case "diner":
      return "Serve the guests with the shortest patience bars first. Keep cooking the next order while your helper carries dishes.";
    case "drill":
      if (s.cargo > 0 || (s.core && !s.coreBanked))
        return "Only cargo returned to the surface counts. Bank a full bag early, then use the cleared shaft for your next trip.";
      if (s.needCore && !s.coreBanked)
        return "The marked ancient core is part of this expedition’s goal. Plan a route to it and leave enough time to return.";
      return "Follow gold and crystals instead of clearing every rock. Vent heat to regain speed, and avoid the marked gas pockets.";
    case "ricochet":
      return "Aim at the lowest enemies first. Bank off a side wall to hit behind shields, or trigger a barrel near a group.";
    case "harbor":
      return "Follow each boat’s arrow all the way to the edge before tapping. Free its blockers first; key boats open their matching locks.";
    case "cleanup":
      return "Switch the filter to job items so finished quotas don’t fill your bag. Take the quick head between groups and unload before you’re full.";
    default:
      return "Your completed stages and workshop upgrades are safe. Try another approach at your own pace.";
  }
}
export function starGoal(id) {
  return (
    {
      robot:
        "3 stars: finish without Undo or Inspect. Up to 3 uses earns 2 stars.",
      harbor:
        "3 stars: no blocked attempts or hints. Fewer than 3 earns 2 stars.",
      ricochet:
        "3 stars: protect all 4 hearts. Finish with 2–3 hearts for 2 stars.",
      diner:
        "3 stars: miss no guests. Fewer than 3 missed guests earns 2 stars.",
      train: "3 stars: finish above 75% hull. Above 35% earns 2 stars.",
      drill:
        "3 stars: finish with over 65 seconds left. Over 25 earns 2 stars.",
      cleanup:
        "3 stars: finish with over 80 seconds left. Over 35 earns 2 stars.",
      worlds:
        "All completed rooms earn 3 stars. Take your time and make it yours.",
    }[id] || "Clear the entire adventure to earn 3 stars."
  );
}

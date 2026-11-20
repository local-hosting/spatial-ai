export type PairedRowSlice = {
  id: string
  source: string
  action_ids: string[]
  place_ids: string[]
  model_picked_expected_place: boolean | null
  action_acceptable: boolean | null
  required_actions_met: boolean | null
  places_subset_of_geo: boolean | null
}

export type PairedCompareSummary = {
  left_model: string
  right_model: string
  identical_output_rows: number
  place_hit_both: number
  place_hit_left_only: number
  place_hit_right_only: number
  place_hit_neither: number
  action_acceptable_both: number
  action_acceptable_left_only: number
  action_acceptable_right_only: number
  geo_place_subset_both: number
}

function placeHit(r: PairedRowSlice): boolean {
  return r.model_picked_expected_place === true
}

function acceptable(r: PairedRowSlice): boolean {
  return r.action_acceptable === true
}

function geoOk(r: PairedRowSlice): boolean {
  return r.places_subset_of_geo === true
}

function sameOutput(a: PairedRowSlice, b: PairedRowSlice): boolean {
  return (
    JSON.stringify(a.action_ids) === JSON.stringify(b.action_ids) &&
    JSON.stringify(a.place_ids) === JSON.stringify(b.place_ids)
  )
}

export function pairedCompareRows(
  leftModel: string,
  rightModel: string,
  left: PairedRowSlice[],
  right: PairedRowSlice[],
): PairedCompareSummary {
  const byId = new Map(right.map((r) => [r.id, r]))
  let identical_output_rows = 0
  let place_hit_both = 0
  let place_hit_left_only = 0
  let place_hit_right_only = 0
  let place_hit_neither = 0
  let action_acceptable_both = 0
  let action_acceptable_left_only = 0
  let action_acceptable_right_only = 0
  let geo_place_subset_both = 0

  for (const a of left) {
    const b = byId.get(a.id)
    if (!b) continue
    if (sameOutput(a, b)) identical_output_rows += 1

    const aPlace = placeHit(a)
    const bPlace = placeHit(b)
    if (aPlace && bPlace) place_hit_both += 1
    else if (aPlace) place_hit_left_only += 1
    else if (bPlace) place_hit_right_only += 1
    else place_hit_neither += 1

    const aAcc = acceptable(a)
    const bAcc = acceptable(b)
    if (aAcc && bAcc) action_acceptable_both += 1
    else if (aAcc) action_acceptable_left_only += 1
    else if (bAcc) action_acceptable_right_only += 1

    if (geoOk(a) && geoOk(b)) geo_place_subset_both += 1
  }

  return {
    left_model: leftModel,
    right_model: rightModel,
    identical_output_rows,
    place_hit_both,
    place_hit_left_only,
    place_hit_right_only,
    place_hit_neither,
    action_acceptable_both,
    action_acceptable_left_only,
    action_acceptable_right_only,
    geo_place_subset_both,
  }
}
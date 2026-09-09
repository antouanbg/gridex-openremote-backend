from dataclasses import dataclass


@dataclass(frozen=True)
class PvArray:
    name: str
    kwp: float
    tilt: float
    azimuth: float


def power_kw(arrays: list[PvArray], gti_w_m2: list[float], ambient_c: float, *, pr: float,
             temp_coeff_per_k: float, noct_c: float, ac_limit_kw: float | None = None) -> float:
    dc_kw = sum(
        array.kwp * max(0.0, gti) / 1000.0
        * (1.0 + temp_coeff_per_k * ((ambient_c + (noct_c - 20.0) / 800.0 * gti) - 25.0))
        for array, gti in zip(arrays, gti_w_m2, strict=True)
    )
    ac_kw = max(0.0, dc_kw * pr)
    return min(ac_kw, ac_limit_kw) if ac_limit_kw is not None else ac_kw


def openremote_power_forecast(*args: object, **kwargs: object) -> float:
    return -power_kw(*args, **kwargs)

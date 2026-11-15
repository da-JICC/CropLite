"""Daily 2025 agricultural indicators with provenance and missingness.

Only queries real upstream NASA POWER / Copernicus on polygon selection. In this
environment no remote observations are bundled. Crop-specific scenario curves
(GDD, ETc mid-stage) are derived on the client without extra API calls.
"""
from __future__ import annotations

import asyncio
import calendar
import math
from datetime import date, timedelta
from collections import defaultdict

from earth_observation_service import DAILY_WEATHER_PARAMETERS, IMERG_PARAMETERS, SMAP_PARAMETERS
from region_service import describe_region

START = date(2025, 1, 1)
END = date(2025, 12, 31)
DAYS = [(START + timedelta(days=i)).isoformat() for i in range(365)]


def real(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def saturation_vapor_pressure(t):
    return 0.6108 * math.exp(17.27 * t / (t + 237.3))


def daily_vpd(tmax, tmin, dewpoint):
    """FAO-56 e_s(Tmax,Tmin) - e_a(Tdew); not an hourly VPD mean."""
    if not all(real(x) for x in (tmax, tmin, dewpoint)):
        return None
    es = (saturation_vapor_pressure(tmax) + saturation_vapor_pressure(tmin))/2
    ea = saturation_vapor_pressure(dewpoint)
    return round(max(0, es - ea), 3)


def extraterrestrial_radiation(lat, day_of_year):
    phi = math.radians(lat)
    dr = 1 + 0.033 * math.cos(2 * math.pi * day_of_year / 365)
    delta = 0.409 * math.sin(2 * math.pi * day_of_year / 365 - 1.39)
    cos_omega = -math.tan(phi) * math.tan(delta)
    omega = math.acos(max(-1, min(1, cos_omega)))
    return (24 * 60 / math.pi) * 0.0820 * dr * (
        omega * math.sin(phi) * math.sin(delta)
        + math.cos(phi) * math.cos(delta) * math.sin(omega))


def daily_eto(tmean, tmin, tmax, dewpoint, wind2m, pressure, rs, latitude, day_of_year):
    """FAO-56 daily Penman-Monteith reference ET0, mm/day.

    Uses sea-level-standard atmospheric approximation to derive elevation from
    POWER PS when on-site altitude is unknown. Rs must be MJ m^-2 day^-1.
    """
    values = (tmean, tmin, tmax, dewpoint, wind2m, pressure, rs, latitude)
    if not all(real(x) for x in values):
        return None
    if not (-50 < tmean < 60 and tmin <= tmax and 0 < pressure < 120 and 0 <= wind2m < 80 and rs >= 0):
        return None
    es = (saturation_vapor_pressure(tmin) + saturation_vapor_pressure(tmax)) / 2
    ea = saturation_vapor_pressure(dewpoint)
    delta = 4098 * saturation_vapor_pressure(tmean) / ((tmean + 237.3)**2)
    gamma = 0.000665 * pressure
    altitude_m = 44330 * (1 - (pressure / 101.325)**(1 / 5.255))
    ra = extraterrestrial_radiation(latitude, day_of_year)
    rso = (0.75 + 0.00002 * altitude_m) * ra
    rns = 0.77 * rs
    if rso <= 0:
        return None
    ratio = max(0.3, min(1.0, rs / rso))
    rnl = (4.903e-9 * ((tmax + 273.16)**4 + (tmin + 273.16)**4) / 2
           * (0.34 - 0.14 * math.sqrt(max(0, ea))) * (1.35 * ratio - 0.35))
    rn = rns - rnl
    numerator = 0.408 * delta * rn + gamma * (900 / (tmean + 273)) * wind2m * max(0, es - ea)
    denominator = delta + gamma * (1 + 0.34 * wind2m)
    if denominator <= 0:
        return None
    return round(max(0, numerator / denominator), 3)


def to_daily_index(rows, field):
    return {row['date']: row.get(field) for row in rows if isinstance(row, dict) and row.get('date') in DAYS}


def package(identifier, name, unit, source, series, *, kind='estimate', method='', limits='', time_standard='LST', resolution='', metadata=None):
    count = sum(real(row.get('value')) for row in series)
    return {
        'id': identifier, 'name': name, 'unit': unit, 'source': source,
        'status': 'success' if count == 365 else 'partial' if count else 'unavailable',
        'coverage': {'start':str(START),'end':str(END),'expected_days':365,'valid_days':count,'missing_days':365-count},
        'daily':series, 'product_type':kind, 'method':method,
        'time_standard':time_standard, 'resolution_note':resolution,
        'limitations':limits, 'metadata':metadata or {},
    }


def dayrows(mapping, key, extra=()):
    return [{'date':day,'value':mapping.get(day,{}).get(key), **{k:mapping.get(day,{}).get(k) for k in extra}}
            for day in DAYS]


def daily_ndvi_rows(year_month_results):
    """Preserve exact 365 dates including clouded/no-overpass days."""
    rows = {day:{'date':day,'value':None,'valid_pixels':0,'valid_percent':0,'total_pixels':0} for day in DAYS}
    moisture = {day:dict(row) for day,row in rows.items()}
    failures = {}
    for month, response, error in year_month_results:
        if error:
            failures[f'{month:02d}'] = error
            continue
        for observation in response.get('observations', []):
            day = observation.get('date')
            if day not in rows:continue
            common = {'valid_pixels':observation.get('valid_pixels',0),
                      'total_pixels':observation.get('total_pixels',0),
                      'valid_percent':observation.get('valid_percent',0)}
            rows[day].update(value=observation.get('mean_ndvi'), **common)
            moisture[day].update(value=observation.get('mean_ndmi'), **common)
    return list(rows.values()),list(moisture.values()),failures


async def analyze_daily_2025(polygon, copernicus, observations):
    """Only 2025, multiple sources independent, no hidden replacement with fake data."""
    region=describe_region(polygon)
    lat=region['representative_point']['latitude']
    lon=region['representative_point']['longitude']
    async def get_power(params,community,standard):
        try:return await observations.daily(lat,lon,START,END,params,community,standard), None
        except Exception as exc:return [],f'{type(exc).__name__}: {exc}'
    sem=asyncio.Semaphore(2)
    async def cop_month(month):
        endday=calendar.monthrange(2025,month)[1]
        async with sem:
            try:
                response=await copernicus.statistics(polygon,date(2025,month,1),date(2025,month,endday),'P1D',include_ndmi=True)
                return month,response,None
            except Exception as exc:
                return month,None,f'{type(exc).__name__}: {exc}'
    weather_pack, radiation_pack, soil_pack, imerg_pack, cop_results=await asyncio.gather(
        get_power(DAILY_WEATHER_PARAMETERS,'AG','LST'),
        get_power(('ALLSKY_SFC_SW_DWN',),'AG','LST'),
        get_power(SMAP_PARAMETERS,'HY','UTC'),
        get_power(IMERG_PARAMETERS,'HY','UTC'),
        asyncio.gather(*(cop_month(m) for m in range(1,13))),
    )
    weather, weather_error=weather_pack
    radiation, radiation_error=radiation_pack
    soil, soil_error=soil_pack
    imerg, imerg_error=imerg_pack
    wr={r['date']:r for r in weather if r.get('date') in DAYS}
    rr={r['date']:r for r in radiation if r.get('date') in DAYS}
    sr={r['date']:r for r in soil if r.get('date') in DAYS}
    ir={r['date']:r for r in imerg if r.get('date') in DAYS}
    datasets={}
    def add(identifier,name,unit,source,mapping,key,*,extra=(),error=None,kind='estimate',method='',limits='',standard='LST',resolution=''):
        datasets[identifier]=package(identifier,name,unit,source,dayrows(mapping,key,extra),
                                    kind=kind,method=method,limits=limits,time_standard=standard,resolution=resolution,
                                    metadata={'error':error} if error else {})
    resmet='NASA POWER: estimaciones gridded meteorológicas puntuales; no mediciones de la parcela.'
    add('temperature','Temperatura del aire','°C','NASA POWER · MET',wr,'mean_c',extra=('min_c','max_c'),error=weather_error,method='T2M; extremos diarios T2M_MIN y T2M_MAX',resolution=resmet)
    add('humidity','Humedad relativa','%','NASA POWER · MET',wr,'relative_humidity_pct',error=weather_error,method='RH2M promedio diario',resolution=resmet)
    add('precipitation_power','Precipitación corregida','mm/día','NASA POWER · MET',wr,'precipitation_mm',error=weather_error,method='PRECTOTCORR',resolution=resmet)
    add('wind','Viento a 2 m','m/s','NASA POWER · MET',wr,'wind_speed_ms',error=weather_error,method='WS2M media diaria; no son ráfagas',resolution=resmet)
    add('pressure','Presión superficial','kPa','NASA POWER · MET',wr,'surface_pressure_kpa',error=weather_error,method='PS',resolution=resmet)
    add('radiation','Radiación solar','MJ/m²/día','NASA POWER · SOL',rr,'solar_radiation_mj_m2_day',error=radiation_error,kind='satélite/modelo',method='ALLSKY_SFC_SW_DWN; comunidad AG',resolution='Radiación diaria modelada/observada; escala regional')
    add('soil_moisture','Humedad superficial','m³/m³','NASA POWER HY / SMAP L4',sr,'surface_moisture_m3_m3',extra=('rootzone_moisture_m3_m3',),error=soil_error,kind='asimilación',method='SFMC (0–5 cm); RZMC (0–100 cm)',resolution='SMAP L4 ~9 km; no representa humedad exacta del lote')
    add('precipitation','Precipitación GPM IMERG','mm/día','NASA POWER HY / GPM IMERG',ir,'imerg_precipitation_mm',error=imerg_error,kind='multisatélite',method='IMERG_PRECTOT (diario UTC)',resolution='~0.1°; no equivale pluviómetro',standard='UTC')
    if datasets['precipitation']['status']=='unavailable' and datasets['precipitation_power']['status']!='unavailable':
        # Fallback is explicitly labelled, not a stitched signal.
        datasets['precipitation']={**datasets['precipitation_power'],'id':'precipitation',
                                  'metadata':{'fallback':'IMERG no disponible; se muestra PRECTOTCORR', 'imerg_error':imerg_error}}
    ndvi,ndmi,cop_errors=daily_ndvi_rows(cop_results)
    for index,rows in (('ndvi',ndvi),('ndmi',ndmi)):
        datasets[index]=package(index,index.upper(),'adimensional','Copernicus Sentinel-2 L2A',rows,
            kind='satélite/polígono',method=('(B08-B04)/(B08+B04)' if index=='ndvi' else '(B08-B11)/(B08+B11)')+' · máscara SCL 4/5',
            resolution='20 m para el análisis conjunto; B11 nativa 20 m',time_standard='UTC',
            limits='Solo días con imágenes válidas libres de nubes. NDMI indica humedad vegetación, NO humedad del suelo.',
            metadata={'failed_months':cop_errors,'cloud_mask':'SCL 4/5','native_B11_m':20})
    # FAO-56 daily VPD and ETo: derived only from valid, mutually compatible inputs.
    vpd_rows=[]; eto_rows=[]; cumulative=[]; running=0.0; broken=False
    for day in DAYS:
        w=wr.get(day,{})
        day_of_year=int(date.fromisoformat(day).strftime('%j'))
        vpd=daily_vpd(w.get('max_c'),w.get('min_c'),w.get('dewpoint_c'))
        eto=daily_eto(w.get('mean_c'),w.get('min_c'),w.get('max_c'),w.get('dewpoint_c'),
                      w.get('wind_speed_ms'),w.get('surface_pressure_kpa'),
                      rr.get(day,{}).get('solar_radiation_mj_m2_day'),lat,day_of_year)
        vpd_rows.append({'date':day,'value':vpd})
        eto_rows.append({'date':day,'value':eto})
        p=w.get('precipitation_mm')
        if not real(p):broken=True
        if not broken:running+=p
        cumulative.append({'date':day,'value':round(running,3) if not broken else None})
    datasets['vpd']=package('vpd','Déficit de presión vapor','kPa','Calculado · NASA POWER',vpd_rows,
       method='FAO-56: [e°(Tmax)+e°(Tmin)]/2 − e°(Tdew)',kind='derivado',
       limits='Aproximación diaria basada en punto de rocío, no VPD horario.')
    datasets['eto']=package('eto','ET₀ referencia FAO-56','mm/día','Calculado · NASA POWER',eto_rows,
       method='FAO-56 Penman–Monteith; Rs, T, viento, rocío, presión y geometría solar',kind='derivado',
       limits='ET0 modelada, no ET real ni ETc. La elevación se aproxima desde presión atmosférica; revisar en terrenos montañosos.')
    datasets['rain_cumulative']=package('rain_cumulative','Precipitación acumulada 2025','mm','Derivado · NASA POWER PRECTOTCORR',cumulative,
       method='Suma desde 1 enero; un día faltante invalida los acumulados siguientes',kind='derivado',
       limits='Acumulado meteorológico; no cuenta riego, infiltración ni escorrentía.')
    return {
       'region':region,'period':{'start':str(START),'end':str(END),'interval':'daily','user_selected_dates':False},
       'datasets':datasets,'status':'partial' if any(v['status']!='success' for v in datasets.values()) else 'success',
       'scope':'2025 (365 fechas). Las imágenes Sentinel-2 no garantizan observación diaria.',
       'sources':{'meteorology':'NASA POWER','soil_moisture':'SMAP L4 vía NASA POWER HY','optical':'Sentinel-2 L2A'},
       'soil_chemistry':{'pH':'no disponible','N':'no disponible','P':'no disponible','K':'no disponible'},
       'limitations':['No se deduce estrés hídrico real sin riego, fecha de siembra, etapa y capacidad de agua disponible del suelo.',
                      'Los cruces de umbral térmico son referencias condicionadas por etapa fenológica; no predicen daños.']
    }

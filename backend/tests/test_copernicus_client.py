from datetime import date
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from copernicus import CopernicusClient, TOKEN_URL, STATS_URL
from test_api import POLYGON

@pytest.mark.asyncio
async def test_oauth_statistics_and_cache(monkeypatch):
    monkeypatch.setenv('CDSE_CLIENT_ID','test-client')
    monkeypatch.setenv('CDSE_CLIENT_SECRET','test-secret')
    seen=[]
    def handler(request):
        seen.append(request.url.path)
        if str(request.url) == TOKEN_URL:
            return httpx.Response(200,json={'access_token':'secret-test-token','expires_in':3600})
        if str(request.url) == STATS_URL:
            assert request.headers['authorization'] == 'Bearer secret-test-token'
            return httpx.Response(200,json={'data':[
                {'interval':{'from':'2026-01-01T00:00:00Z','to':'2026-01-11T00:00:00Z'},'outputs':{'ndvi':{'bands':{'B0':{'stats':{'sampleCount':100,'noDataCount':20,'mean':0.6,'min':0.3,'max':0.8}}}}}},
                {'interval':{'from':'2026-01-11T00:00:00Z','to':'2026-01-21T00:00:00Z'},'outputs':{'ndvi':{'bands':{'B0':{'stats':{'sampleCount':100,'noDataCount':100,'mean':0}}}}}}
            ]})
        return httpx.Response(404)
    actual_client = httpx.AsyncClient
    def fake_client(*args,**kwargs):
        return actual_client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx,'AsyncClient',fake_client)
    client = CopernicusClient()
    first = await client.statistics(POLYGON,date(2026,1,1),date(2026,1,21),'P10D')
    assert first['status'] == 'observed'
    assert first['observations'][0]['valid_pixels'] == 80
    assert first['observations'][0]['valid_percent'] == 80
    assert first['observations'][1]['mean_ndvi'] is None
    assert not first['cache_hit']
    second = await client.statistics(POLYGON,date(2026,1,1),date(2026,1,21),'P10D')
    assert second['cache_hit']
    assert len(seen)==2

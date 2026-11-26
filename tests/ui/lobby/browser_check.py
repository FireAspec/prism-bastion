"""Run against the Vite fixture: python tests/ui/lobby/browser_check.py [url]."""
import sys
from playwright.sync_api import sync_playwright, expect
url = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:5173/tests/ui/lobby/preview.html'
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium' if sys.platform.startswith('linux') else None,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    page.set_default_timeout(2500)
    expect.set_options(timeout=2500)
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    if url.endswith(".html") and not url.startswith(("http:","https:")):
        from pathlib import Path
        page.set_content(Path(url).read_text(encoding="utf-8"))
    else:
        page.goto(url)
    panel=page.locator('.pb-lobby')
    def state(s): page.locator('#states').get_by_role('button',name=s,exact=True).click()
    def submit(): panel.locator('button[type=submit]').click()
    def msg(s): expect(panel.locator('[role=status]')).to_contain_text(s)
    def calls(): return page.evaluate('window.fixture.calls()')
    expect(panel.locator('input[name=password]')).to_have_attribute('type','password')
    submit();msg('Введите имя');assert calls()==[]
    panel.locator('input[name=name]').fill('Маяк');panel.locator('input[name=port]').fill('65536');submit();msg('Порт');assert calls()==[]
    panel.locator('input[name=port]').fill('43127');panel.locator('input[name=password]').fill('private');submit();expect(panel.get_by_text('Адреса для друзей')).to_be_visible();assert calls()[0]['kind']=='host';assert calls()[0]['value']['password']=='[set]'
    assert 'private' not in panel.inner_text();expect(panel.get_by_role('button',name='Начать без полной готовности')).to_be_disabled()
    state('join');panel.locator('input[name=name]').fill('Искра');panel.locator('input[name=address]').fill('999.1.1.1');submit();msg('IPv4');assert calls()==[]
    panel.locator('input[name=address]').fill('192.168.1.10');page.evaluate("window.fixture.fail('host offline')");submit();msg('брандмауэре');assert calls()[0]['value']['url']=='ws://192.168.1.10:43127'
    page.evaluate("window.fixture.fail('digest mismatch')");submit();msg('не совпадают')
    page.evaluate("window.fixture.fail('wrong password')");submit();msg('Неверный пароль')
    page.evaluate("window.fixture.fail('room_full')");submit();msg('нет свободных мест')
    page.evaluate("window.fixture.fail('')");submit();expect(panel.get_by_text('Запуск подтверждает хост.')).to_be_visible()
    panel.get_by_role('button',name='Готов',exact=True).click();assert calls()[-1]=={'kind':'ready','value':True};expect(panel.get_by_role('button',name='Готов',exact=True)).to_be_disabled()
    panel.get_by_role('button',name='Не готов',exact=True).click();assert calls()[-1]=={'kind':'ready','value':False}
    state('host');expect(panel.locator('.pb-lobby__slots li')).to_have_count(4)
    page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error())}}); document.execCommand=()=>false")
    panel.get_by_role('button',name='Копировать').first.click();msg('Ctrl+C');assert page.evaluate('document.activeElement.selectionEnd > 0')
    panel.get_by_role('button',name='Начать без полной готовности').click();expect(panel.get_by_role('button',name='Подтвердить запуск')).to_be_focused();panel.get_by_role('button',name='Отмена').click();assert calls()==[]
    panel.get_by_role('button',name='Начать без полной готовности').click();panel.get_by_role('button',name='Подтвердить запуск').click();assert calls()[-1]['kind']=='start';expect(panel.get_by_text('Игра началась')).to_be_visible()
    state('ready');panel.get_by_role('button',name='Начать игру',exact=True).click();assert calls()[-1]['kind']=='start'
    for key,phrase in [('mismatch','не совпадают'),('reconnect','120 секунд'),('expired','истекло'),('offline','брандмауэре')]:
        state(key);msg(phrase);expect(panel.get_by_role('button',name='Готов',exact=True)).to_be_disabled()
    state('started');expect(panel.get_by_text('1125',exact=True)).to_be_visible();expect(panel.get_by_text('150',exact=True)).to_be_visible()
    state('english');expect(panel.get_by_role('heading',name='Play with friends')).to_be_visible()
    state('join');panel.locator('input[name=name]').fill('Искра');panel.locator('input[name=address]').fill('[::1]');page.evaluate('window.fixture.hold()');submit();msg('Подключение');panel.get_by_role('button',name='Назад').click();expect(panel).to_be_hidden();assert calls()[-1]['kind']=='leave'
    state('disposed');expect(panel).to_have_count(0)
    state('create');page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');
    state('host');assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert not errors,errors
    print('PASS: forms, validation, host/join errors, slots, readiness, forced start, clipboard fallback, reconnect, mismatch, wallet, EN, leave/dispose, responsive width')
    if '--screenshots' in sys.argv:
        page.set_viewport_size({'width':1366,'height':768});
        for key in ['create','join','host','reconnect','mismatch','started']:
            state(key);page.screenshot(path=f'/mnt/data/lobby61-{key}.png',full_page=True)
    browser.close()

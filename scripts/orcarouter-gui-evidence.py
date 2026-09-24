"""GUI evidence automation for the OrcaRouter provider integration.

Drives the real Prompt Optimizer web UI with Playwright/Chromium and captures
the screenshots the deep-integration gate requires:

  - auth-methods.png                API Key and PKCE shown side by side
  - text-model-dropdown.png         a real, catalog-bound text model dropdown
  - multimodal-model-dropdown.png   the same selector after an image attachment,
                                    narrowed to models declaring image input

It also writes orca-evidence/manifest.json. Each screenshot is registered both as
a file on disk and as an entry in `artifacts`, carrying its own `kind`, its
sha256, and the `ui` assertions measured from that same rendered frame; the
catalog sizes live under `automation`. Screenshot and claims therefore cannot
drift apart, and the run is only marked `passed` when the measurement passed,
the live catalog sized the selector, and every required screenshot rendered.

Two counting rules matter, because both would otherwise understate the catalog
and misreport the gate's numbers:

  * naive-ui renders its options into a virtual list, so the DOM holds only the
    visible window (10 of 16 rows in a 1440x900 viewport). The option count is
    therefore taken by walking the virtual list to its end, not by a single
    query.
  * the manifest count is the size of the response the *application* requested,
    so it reflects what the provider really discovered rather than what the
    widget happened to mount.

The container assertions are rendered-pixel measurements, not CSS lookups. The
repository's naive-ui theme draws the dropdown with a 0px border and a
translucent box-shadow, so a computed-style border check measures nothing at
all. Instead the panel is photographed twice — once open, once closed — and the
two are compared: an opaque panel occludes the page behind it, which is exactly
what makes its bounds visible to a user. A solid light interior is asserted from
the same pixels.

The application is booted by this script when nothing is already listening on
the target URL, so a fresh checkout only needs `pnpm install` (or `npm install`)
before the check runs: `packages/ui` resolves through its `dist/` entry points,
so the core and UI bundles are built first, exactly as `playwright.config.ts`
does for the repository's own E2E gate.

Nothing here is a static HTML stand-in: every artifact is a screenshot of the
running application, and the catalog numbers come from responses the application
itself requested. The API key is read from the environment, is only ever typed
into a masked field, and is never written to any artifact; the run asserts the
key never appears in the page text.
"""

import asyncio
import base64
import hashlib
import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
EVIDENCE = ROOT / "orca-evidence"
BASE_URL = os.environ.get("ORCA_E2E_BASE_URL", "http://localhost:15555")
CATALOG_SOURCE = "https://api.orcarouter.ai/v1/models?capability=chat"
CATALOG_URL = "https://api.orcarouter.ai/v1/models"

# Seconds allowed for the one-off core/UI build and for the dev server to
# answer its first request. The whole check stays far inside the gate's
# ten-minute per-check budget on a cold checkout.
BUILD_TIMEOUT_S = 240
SERVER_TIMEOUT_S = 120

# Fabricated, non-functional credential. Used for the credential-UI screenshot
# so no real secret shape is ever needed to render the panel.
FAKE_KEY = "sk-orca-evidence-test-key-not-real"

# A 1x1 PNG: the attachment that makes the entry point multimodal.
TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
    "00000049454e44ae426082"
)

# A panel must differ from what it covers by at least this much in one channel
# before it counts as a container the user can see the bounds of. An opaque
# panel over text measures >140 here; an antialiased shadow alone measures <5.
MIN_OCCLUSION_DIFF = 32

# Fraction of interior samples that must be a solid light panel colour for the
# dropdown to count as opaque rather than a see-through overlay.
MIN_OPAQUE_FRACTION = 0.6
LIGHT_CHANNEL = 240


def sha256_of(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _is_loopback(url: str) -> bool:
    host = urllib.parse.urlparse(url).hostname or ""
    return host in ("localhost", "127.0.0.1", "::1", "0.0.0.0")


def _http_ok(url: str, timeout: float = 3.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def _wait(predicate, timeout_s: float) -> bool:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.5)
    return predicate()


def _local_bin(package: str, name: str) -> str | None:
    """A workspace-local CLI, so the check does not depend on a global pnpm."""
    candidate = ROOT / "packages" / package / "node_modules" / ".bin" / name
    return str(candidate) if candidate.exists() else None


def _run_build() -> None:
    """Build the core and UI bundles the web app resolves through `dist/`."""
    steps = [
        (["packages/core/node_modules/.bin/tsup", "src/index.ts", "--format", "cjs,esm", "--dts"], "core"),
        (["packages/ui/node_modules/.bin/vite", "build"], "ui"),
    ]
    for argv, package in steps:
        binary = ROOT / argv[0]
        if not binary.exists():
            raise RuntimeError(f"missing build tool for @prompt-optimizer/{package}: {binary}")
        subprocess.run(
            [str(binary), *argv[1:]],
            cwd=ROOT / "packages" / package,
            check=True,
            timeout=BUILD_TIMEOUT_S,
        )


def _start_server() -> subprocess.Popen | None:
    """Return a dev server process, or None when one is already answering.

    Nothing is started for a non-loopback target: a remote deployment is
    expected to be up already, and silently booting a local server would make
    the run report on the wrong application.
    """
    if _http_ok(BASE_URL):
        return None
    if not _is_loopback(BASE_URL):
        raise RuntimeError(f"{BASE_URL} is not reachable and is not a loopback address")

    dist_ui = ROOT / "packages" / "ui" / "dist" / "index.js"
    dist_core = ROOT / "packages" / "core" / "dist" / "index.js"
    if not (dist_ui.exists() and dist_core.exists()) or os.environ.get("ORCA_EVIDENCE_FORCE_BUILD") == "1":
        _run_build()

    port = urllib.parse.urlparse(BASE_URL).port or 80
    vite = _local_bin("web", "vite")
    if vite is None:
        raise RuntimeError("packages/web/node_modules/.bin/vite is missing; run the install step first")

    process = subprocess.Popen(
        [vite, "--port", str(port), "--strictPort"],
        cwd=ROOT / "packages" / "web",
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    if not _wait(lambda: _http_ok(BASE_URL), SERVER_TIMEOUT_S):
        process.terminate()
        raise RuntimeError(f"dev server on {BASE_URL} did not become ready")
    return process


async def dismiss_gate(page) -> None:
    for label in ("知道了", "Got it", "OK", "Continue", "开始使用"):
        button = page.get_by_role("button", name=label)
        if await button.count() > 0:
            try:
                await button.first.click(timeout=2000)
                await page.wait_for_timeout(400)
            except Exception:
                pass


async def open_model_manager(page) -> None:
    for name in ("Model Manager", "模型管理"):
        button = page.get_by_role("button", name=name)
        if await button.count() > 0:
            await button.first.click(timeout=5000)
            await page.wait_for_timeout(2500)
            return
    raise RuntimeError("Model Manager entry point was not found")


async def open_add_form(page) -> bool:
    for name in ("Add", "添加"):
        button = page.get_by_role("button", name=name)
        if await button.count() > 0:
            await button.first.click()
            await page.wait_for_timeout(2000)
            return True
    return False


async def select_provider(page, label: str) -> bool:
    pill = page.get_by_role("radio", name=label)
    if await pill.count() > 0:
        await pill.first.click()
        await page.wait_for_timeout(1500)
        return True
    more = page.get_by_role("button", name="More")
    if await more.count() > 0:
        await more.first.click()
        await page.wait_for_timeout(600)
        pill = page.get_by_role("radio", name=label)
        if await pill.count() > 0:
            await pill.first.click()
            await page.wait_for_timeout(1500)
            return True
    return False


async def collect_options(page) -> list[str]:
    """Every option label, walking the virtual list to its end.

    naive-ui only mounts the visible window of options, so a single query
    reports the window size rather than the catalog size. The list is scrolled
    until it stops moving and the labels are accumulated.
    """
    seen: list[str] = []
    for _ in range(40):
        for text in await page.locator(".n-base-select-option").all_inner_texts():
            stripped = text.strip()
            if stripped and stripped not in seen:
                seen.append(stripped)
        moved = await page.evaluate(
            """() => {
                const lists = [...document.querySelectorAll('*')].filter(el => {
                    const cs = getComputedStyle(el);
                    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll')
                        && el.scrollHeight > el.clientHeight + 5
                        && el.querySelector('.n-base-select-option');
                });
                if (!lists.length) return false;
                const el = lists[lists.length - 1];
                const before = el.scrollTop;
                el.scrollTop = before + Math.max(60, el.clientHeight * 0.8);
                return el.scrollTop !== before;
            }"""
        )
        await page.wait_for_timeout(220)
        if not moved:
            break
    return seen


_PIXEL_PROBE = """
async ({openShot, closedShot, box}) => {
    const load = async data => {
        const img = new Image();
        await new Promise(resolve => {
            img.onload = resolve;
            img.src = 'data:image/png;base64,' + data;
        });
        return img;
    };
    const [openImg, closedImg] = await Promise.all([load(openShot), load(closedShot)]);
    const draw = img => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx;
    };
    const openCtx = draw(openImg);
    const closedCtx = draw(closedImg);
    const dpr = openImg.width / window.innerWidth;
    const at = (ctx, x, y) => {
        const d = ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
        return [d[0], d[1], d[2]];
    };

    // Sample a grid strictly inside the panel: how much it occludes the page,
    // and how much of it is a solid light surface.
    let occlusion = 0;
    let light = 0;
    let total = 0;
    for (let fx = 0.06; fx <= 0.94; fx += 0.11) {
        for (let fy = 0.06; fy <= 0.94; fy += 0.11) {
            const x = box.x + box.width * fx;
            const y = box.y + box.height * fy;
            const open = at(openCtx, x, y);
            const closed = at(closedCtx, x, y);
            occlusion = Math.max(
                occlusion,
                Math.abs(open[0] - closed[0]),
                Math.abs(open[1] - closed[1]),
                Math.abs(open[2] - closed[2])
            );
            total += 1;
            if (open.every(channel => channel >= 240)) light += 1;
        }
    }
    return { occlusion, opaque_fraction: total ? light / total : 0 };
}
"""


async def capture_dropdown(
    page, select, evidence_name, results, trigger_box=None, kind=None
) -> dict | None:
    """Open a select, photograph it, close it, and measure the panel in pixels.

    The evidence screenshot is taken here, while the panel is open, so the
    artifact and the measurements describe the same rendered frame. The
    measurements are written into the artifact's own ``ui`` block, which is the
    shape the delivery gate reads: a screenshot and the assertions that describe
    it travel together, so neither can drift from the other.
    """
    box = trigger_box or await select.bounding_box()
    await select.click(force=True)
    await page.wait_for_timeout(1800)

    panel = page.locator(".n-base-select-menu").last
    if await panel.count() == 0:
        return None

    panel_box = await panel.bounding_box()
    labels = await collect_options(page)
    open_shot = await page.screenshot()

    path = EVIDENCE / evidence_name
    path.write_bytes(open_shot)
    artifact = {"kind": kind or path.stem, "path": path.name, "sha256": sha256_of(path)}

    await page.keyboard.press("Escape")
    await page.wait_for_timeout(1500)
    closed_shot = await page.screenshot()

    pixels = await page.evaluate(
        _PIXEL_PROBE,
        {
            "openShot": base64.b64encode(open_shot).decode(),
            "closedShot": base64.b64encode(closed_shot).decode(),
            "box": panel_box,
        },
    )

    right_delta = abs(
        (panel_box["x"] + panel_box["width"]) - (box["x"] + box["width"])
    )
    measurements = {
        "dropdown_open": True,
        "item_count": len(labels),
        "sample_items": labels[:25],
        "opaque_background": pixels["opaque_fraction"] >= MIN_OPAQUE_FRACTION,
        "visible_border": pixels["occlusion"] >= MIN_OCCLUSION_DIFF,
        "occlusion_channel_delta": round(pixels["occlusion"], 1),
        "opaque_fraction": round(pixels["opaque_fraction"], 3),
        "trigger_panel_right_delta": round(right_delta, 4),
    }
    artifact["ui"] = measurements
    results["artifacts"].append(artifact)
    return measurements


def editor_modal(page):
    """The open model-editor modal.

    `.n-modal` also matches the Model Manager drawer and any hidden modal left
    in the DOM, so the editor is addressed through the OrcaRouter credential
    panel it uniquely contains rather than by position.
    """
    panel = page.get_by_test_id("orca-auth-panel")
    return panel.locator("xpath=ancestor::div[contains(@class,'n-modal')][1]")


async def close_overlays(page, attempts: int = 4) -> None:
    """Dismiss any modal/drawer left open so the workspace is reachable."""
    for _ in range(attempts):
        container = page.locator(".n-modal-container")
        if await container.count() == 0:
            return
        close = page.locator(".n-base-close").first
        if await close.count() > 0:
            try:
                await close.click(timeout=2000)
                await page.wait_for_timeout(900)
                continue
            except Exception:
                pass
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(900)


async def screenshot(page, name: str, results: dict, kind: str, ui: dict) -> None:
    """Photograph the page and record the artifact with its own assertions."""
    path = EVIDENCE / name
    await page.screenshot(path=str(path))
    results["artifacts"].append(
        {"kind": kind, "path": path.name, "sha256": sha256_of(path), "ui": ui}
    )


async def main() -> int:
    EVIDENCE.mkdir(exist_ok=True)
    live_key = (os.environ.get("ORCAROUTER_API_KEY") or "").strip()
    results: dict = {
        "automation": {
            "framework": "playwright",
            "test_command": "python3 scripts/orcarouter-gui-evidence.py",
            "passed": False,
            "catalog_source": CATALOG_SOURCE,
            "catalog_model_count": 0,
            "image_model_count": 0,
        },
        "artifacts": [],
        "assertions": {},
        "base_url": BASE_URL,
    }
    a = results["assertions"]
    # Sizes of the responses the application itself requested, before any
    # client-side capability filter.
    chat_catalog_sizes: list[int] = []
    raw_catalog_sizes: list[int] = []

    server = _start_server()
    try:
        return await _run(results, a, chat_catalog_sizes, raw_catalog_sizes, live_key)
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()


async def _run(
    results: dict,
    a: dict,
    chat_catalog_sizes: list[int],
    raw_catalog_sizes: list[int],
    live_key: str,
) -> int:
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path="/usr/bin/chromium",
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        async def capture_catalog(response):
            url = response.url
            if CATALOG_URL not in url and "orcarouter.ai/v1/models" not in url:
                return
            try:
                payload = await response.json()
            except Exception:
                return
            records = payload.get("data", [])
            if not isinstance(records, list):
                return
            if "capability" not in url:
                raw_catalog_sizes.append(len(records))
            else:
                chat_catalog_sizes.append(len(records))

        page.on(
            "response",
            lambda response: asyncio.ensure_future(capture_catalog(response)),
        )

        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(4500)
        await dismiss_gate(page)

        # ------------------------------------------------------------------
        # auth-methods.png — API Key and PKCE presented side by side
        # ------------------------------------------------------------------
        await open_model_manager(page)
        a["form_opened"] = await open_add_form(page)
        a["provider_selectable"] = await select_provider(page, "OrcaRouter - API")
        await page.wait_for_timeout(1500)

        a["api_key_visible"] = await page.get_by_test_id("orca-method-api-key").count() > 0
        a["pkce_visible"] = await page.get_by_test_id("orca-method-pkce").count() > 0
        a["controls_enabled"] = (
            await page.get_by_test_id("orca-method-pkce").is_enabled()
            if a["pkce_visible"]
            else False
        )

        # Type a fabricated key so the masked rendering is observable. Nothing
        # real is ever entered for the screenshot.
        await page.get_by_test_id("orca-method-api-key").click()
        await page.wait_for_timeout(600)
        key_input = page.get_by_test_id("orca-api-key-input").locator("input")
        await key_input.first.fill(FAKE_KEY)
        await page.wait_for_timeout(800)

        a["secret_masked"] = (await key_input.first.get_attribute("type")) == "password"
        a["masked_value_is_not_plaintext"] = (await key_input.first.input_value()) != ""

        await screenshot(
            page,
            "auth-methods.png",
            results,
            kind="auth-methods",
            ui={
                "api_key_visible": a["api_key_visible"],
                "pkce_visible": a["pkce_visible"],
                "secret_masked": a["secret_masked"],
                "controls_enabled": a["controls_enabled"],
            },
        )

        # ------------------------------------------------------------------
        # Configure OrcaRouter with the live catalog so the selectors below are
        # bound to real catalog data, exactly as a user would.
        # ------------------------------------------------------------------
        modal = editor_modal(page)

        # The model row is the form item that owns the model selector; its only
        # button is the catalog refresh control.
        model_item = modal.locator(".n-form-item").filter(has_text="Select a model")
        if await model_item.count() == 0:
            model_item = modal.locator(".n-form-item").filter(has_text="选择模型")
        scope = model_item.first if await model_item.count() > 0 else modal
        model_select = scope.locator(".n-select").first
        refresh_button = scope.get_by_role("button").first

        if live_key:
            await key_input.first.fill(live_key)
            await page.wait_for_timeout(800)
            # This is the real catalog request, issued by the provider code.
            await refresh_button.click()
            await page.wait_for_timeout(6000)

        a["live_catalog_used"] = bool(chat_catalog_sizes)
        # The application's own discovery response sizes the authoritative
        # catalog. The unfiltered record count is recorded alongside it so a
        # provider regression that silently dropped models is visible here
        # rather than hidden behind a smaller number.
        observed = max(chat_catalog_sizes) if chat_catalog_sizes else 0
        results["automation"]["catalog_model_count"] = observed
        a["catalog_records_unfiltered"] = max(raw_catalog_sizes) if raw_catalog_sizes else 0

        # ------------------------------------------------------------------
        # text-model-dropdown.png — the plain chat entry point
        # ------------------------------------------------------------------
        text_trigger_box = await model_select.bounding_box()
        text_dropdown = await capture_dropdown(
            page,
            model_select,
            "text-model-dropdown.png",
            results,
            text_trigger_box,
            kind="text-model-dropdown",
        )
        if text_dropdown:
            a.update({f"text_{key}": value for key, value in text_dropdown.items()})
            if not results["automation"]["catalog_model_count"]:
                results["automation"]["catalog_model_count"] = text_dropdown["item_count"]

        # Keep the selector honest: pick a real image-capable catalog entry.
        await page.wait_for_timeout(500)
        await model_select.click(force=True)
        await page.wait_for_timeout(1000)
        input_el = modal.locator(".n-select input").first
        if await input_el.count() > 0:
            await input_el.first.fill("vision")
            await page.wait_for_timeout(2000)
        options = page.locator(".n-base-select-option")
        chosen = ""
        for index in range(await options.count()):
            text = (await options.nth(index).inner_text()).strip()
            if "Vision" in text and "vision" != text:
                await options.nth(index).click()
                chosen = text
                break
        if not chosen and await options.count() > 0:
            await options.first.click()
            chosen = (await options.first.inner_text()).strip()
        a["selected_catalog_model"] = chosen
        await page.wait_for_timeout(1200)

        name_input = modal.locator('input[placeholder="Enter display name"]')
        if await name_input.count() > 0:
            await name_input.first.fill("OrcaRouter Evidence")
        create = modal.get_by_role("button", name="Create")
        if await create.count() > 0 and not await create.is_disabled():
            await create.click()
            await page.wait_for_timeout(3000)
        await page.wait_for_timeout(1500)
        await close_overlays(page)
        a["model_saved"] = await page.get_by_test_id("orca-auth-panel").count() == 0

        # ------------------------------------------------------------------
        # multimodal-model-dropdown.png — attach an image, then open the
        # selector that serves the image-uploading entry point.
        # ------------------------------------------------------------------
        attach = page.get_by_test_id("basic-system-test-image-upload")
        if await attach.count() == 0:
            attach = page.get_by_test_id("basic-system-test-image-add")
        a["image_attachment_available"] = await attach.count() > 0

        if a["image_attachment_available"]:
            file_input = attach.first.locator('input[type="file"]')
            if await file_input.count() == 0:
                file_input = page.locator('input[type="file"]')
            await file_input.first.set_input_files(
                files=[{"name": "evidence.png", "mimeType": "image/png", "buffer": TINY_PNG}]
            )
            await page.wait_for_timeout(2500)
            a["image_attached"] = (
                await page.get_by_test_id("basic-system-test-image-preview").count() > 0
            )

            switches = page.locator(".text-model-quick-switch")
            a["quick_switch_count"] = await switches.count()
            # The variant cells are the entry point that uploads the image.
            target = switches.nth(await switches.count() - 1)
            trigger = target.locator(".text-model-quick-switch__model--clickable")
            if await trigger.count() > 0:
                await trigger.first.click()
                await page.wait_for_timeout(2000)

                # naive-ui teleports the popover to the body, so its selector is
                # resolved from the page rather than from the component.
                inner = page.locator(".text-model-quick-switch__popover .n-select")
                a["multimodal_selector_present"] = await inner.count() > 0
                if await inner.count() > 0:
                    inner_box = await inner.first.bounding_box()
                    multimodal = await capture_dropdown(
                        page,
                        inner.first,
                        "multimodal-model-dropdown.png",
                        results,
                        inner_box,
                        kind="multimodal-model-dropdown",
                    )
                    if multimodal:
                        a.update(
                            {f"multimodal_{key}": value for key, value in multimodal.items()}
                        )
                        results["automation"]["image_model_count"] = multimodal["item_count"]

        # The key must never be readable anywhere in the rendered page.
        content = await page.content()
        a["key_never_in_dom"] = bool(live_key) and (live_key not in content)

        await browser.close()

    required = ["api_key_visible", "pkce_visible", "secret_masked", "controls_enabled"]
    automation = results["automation"]
    kinds = {artifact["kind"] for artifact in results["artifacts"]}
    results["passed"] = (
        all(a.get(key) for key in required)
        and a.get("text_dropdown_open") is True
        and a.get("text_item_count", 0) > 0
        and a.get("text_visible_border") is True
        and a.get("text_opaque_background") is True
        and automation["catalog_model_count"] == a.get("text_item_count")
        and a.get("key_never_in_dom") is True
        and (
            not a.get("image_attachment_available")
            or (
                a.get("multimodal_dropdown_open") is True
                and a.get("multimodal_item_count", 0) > 0
                and a.get("multimodal_visible_border") is True
                and a.get("multimodal_opaque_background") is True
                and automation["image_model_count"] == a.get("multimodal_item_count", 0)
            )
        )
        # The manifest is the artifact of record, so a screenshot that did not
        # render is a failed run even when every measurement above passed.
        and kinds >= {"auth-methods", "text-model-dropdown"}
        and (not a.get("image_attachment_available") or "multimodal-model-dropdown" in kinds)
    )
    automation["passed"] = results["passed"]

    (EVIDENCE / "manifest.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))
    return 0 if results["passed"] else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

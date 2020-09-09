#!/bin/env python3

"""
This program is mostly equivalent to ares-package from WebOS SDK, but takes
less than a second to complete instead of, like, forever. This helps achieving
faster development iterations.

The only difference with ares-package is that this program doesn't try to
minify sources.

This program depends on dpkg-deb(1).
"""

from pathlib import Path
import json
import shutil
import subprocess
import tempfile

APPLICATIONS = Path("usr/palm/applications")
PACKAGES = Path("usr/palm/packages")
PACKAGEINFO = "packageinfo.json"

this = Path(__file__).parent.resolve()


with tempfile.TemporaryDirectory() as tmp_:
    tmp = Path(tmp_)

    src = this / "src"

    appinfo = json.load((src / "appinfo.json").open())
    name = appinfo["id"]
    version = appinfo["version"]
    vendor = appinfo["vendor"]

    output_name = f"{name}_{version}_all.ipk"
    output = this / output_name

    build = tmp / "build"
    target = build / APPLICATIONS / name
    control = build / "DEBIAN" / "control"
    packageinfo = build / PACKAGES / name / PACKAGEINFO

    shutil.copytree(src, target)
    packageinfo.parent.mkdir(parents=True)
    control.parent.mkdir(parents=True)

    size = sum(f.stat().st_size for f in target.glob("**/*") if f.is_file())

    with control.open("w") as f:
        f.write(
            "\n".join(
                [
                    f"Package: {name}",
                    f"Version: {version}",
                    "Section: misc",
                    "Priority: optional",
                    "Architecture: all",
                    f"Installed-Size: {size}",
                    f"Maintainer: {vendor} <{vendor}@example.org>",
                    "Description: This is a webOS application.",
                    "webOS-Package-Format-Version: 2",
                    "webOS-Packager-Version: x.y.x",
                    "",
                ]
            )
        )

    with packageinfo.open("w") as f:
        json.dump(
            {
                "id": name,
                "version": version,
                "app": name,
            },
            f,
        )

    subprocess.run(
        ["dpkg-deb", "-Zgzip", "--build", str(build), str(output)],
        stdout=subprocess.DEVNULL,
    )
    print(str(output))

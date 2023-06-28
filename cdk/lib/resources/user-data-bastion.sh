#!/bin/bash
set -o nounset -o errexit -o pipefail

# Poweroff this host if there has been no SSM session for 30 minutes.
mkdir -p /root/bin
cat <<'EOF' > /root/bin/poweroff-timer
#!/bin/bash
set -o nounset -o errexit -o pipefail
thresh=1800
file="/tmp/activity"
if ! test -e "$file" || pgrep -x -U ssm-user sh > /dev/null; then touch "$file"; fi
eif test "$(date +%s)" -lt $(($(stat -c %Y "$file") + thresh)); then exit; fi
poweroff
EOF
chmod 755 /root/bin/poweroff-timer

# Poweroff this host at 5:00 AM in the specified time zone.
tz=+9
cat <<EOF > /etc/cron.d/bastion
SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin:/root/bin
MAILTO=root
*/3 * * * * root poweroff-timer
0 $(((5 - tz + 24) % 24)) * * * root poweroff
EOF

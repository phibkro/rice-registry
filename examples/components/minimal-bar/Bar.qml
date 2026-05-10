import Quickshell
import Quickshell.Hyprland
import QtQuick

PanelWindow {
    anchors {
        top: true
        left: true
        right: true
    }
    height: 32
    color: Qt.rgba(0, 0, 0, 0)

    Rectangle {
        anchors.fill: parent
        color: "var(--background)"
        opacity: 0.92

        Row {
            anchors.left: parent.left
            anchors.leftMargin: 8
            anchors.verticalCenter: parent.verticalCenter
            spacing: 6

            Repeater {
                model: Hyprland.workspaces
                Rectangle {
                    width: 24; height: 20
                    color: modelData.active ? "var(--primary)" : "var(--muted)"
                    radius: 4
                    Text {
                        anchors.centerIn: parent
                        text: modelData.id
                        color: modelData.active ? "var(--primary-foreground)" : "var(--foreground)"
                    }
                }
            }
        }

        Text {
            anchors.centerIn: parent
            color: "var(--foreground)"
            font.family: "var(--font-mono)"
            text: Qt.formatDateTime(new Date(), "ddd HH:mm")
        }
    }
}

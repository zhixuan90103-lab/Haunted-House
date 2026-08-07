import AudioToolbox
import Capacitor
import CoreHaptics
import UIKit

@objc(AdvancedHapticsPlugin)
public class AdvancedHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AdvancedHapticsPlugin"
    public let jsName = "AdvancedHaptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "notification", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "selection", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "playPattern", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stackImpact", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startContinuousHaptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateContinuousHaptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopContinuousHaptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "diagnose", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buzz", returnType: CAPPluginReturnPromise),
    ]

    private var engine: CHHapticEngine?
    private var continuousPlayer: CHHapticAdvancedPatternPlayer?
    private var isEngineRunning = false

    // Keep generators alive (UIKit: must not be local ephemeral for reliable feedback)
    private var impactLight = UIImpactFeedbackGenerator(style: .light)
    private var impactMedium = UIImpactFeedbackGenerator(style: .medium)
    private var impactHeavy = UIImpactFeedbackGenerator(style: .heavy)
    private var impactSoft = UIImpactFeedbackGenerator(style: .soft)
    private var impactRigid = UIImpactFeedbackGenerator(style: .rigid)
    private var notificationGen = UINotificationFeedbackGenerator()
    private var selectionGen = UISelectionFeedbackGenerator()

    override public func load() {
        initEngine()
        onMain {
            self.impactLight.prepare()
            self.impactMedium.prepare()
            self.impactHeavy.prepare()
            self.impactSoft.prepare()
            self.impactRigid.prepare()
            self.notificationGen.prepare()
            self.selectionGen.prepare()
        }
    }

    private func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.sync(execute: block)
        }
    }

    // MARK: - CHHapticEngine

    private func initEngine() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            engine = try CHHapticEngine()
            engine?.playsHapticsOnly = true
            engine?.isAutoShutdownEnabled = false
            engine?.resetHandler = { [weak self] in
                self?.isEngineRunning = false
                self?.startEngineIfNeededQuietly()
            }
            engine?.stoppedHandler = { [weak self] _ in
                self?.isEngineRunning = false
            }
            startEngineIfNeededQuietly()
        } catch {
            CAPLog.print("⚡️ AdvancedHaptics engine init failed: \(error)")
        }
    }

    private func ensureEngineRunning() throws {
        if engine == nil {
            initEngine()
        }
        guard let engine = engine else {
            throw NSError(
                domain: "AdvancedHaptics",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "Engine not initialized / no Core Haptics"]
            )
        }
        if !isEngineRunning {
            try engine.start()
            isEngineRunning = true
        }
    }

    private func startEngineIfNeededQuietly() {
        do {
            try ensureEngineRunning()
        } catch {
            CAPLog.print("⚡️ AdvancedHaptics engine start failed: \(error)")
        }
    }

    // MARK: - diagnose

    @objc public func diagnose(_ call: CAPPluginCall) {
        let supports = CHHapticEngine.capabilitiesForHardware().supportsHaptics
        var engineOk = false
        var engineError = ""
        do {
            try ensureEngineRunning()
            engineOk = engine != nil && isEngineRunning
        } catch {
            engineError = String(describing: error)
        }
        call.resolve([
            "plugin": "AdvancedHaptics",
            "supportsCoreHaptics": supports,
            "engineRunning": engineOk,
            "engineError": engineError,
            "hasContinuousPlayer": continuousPlayer != nil,
            "thread": Thread.isMainThread ? "main" : "bg",
        ])
    }

    // MARK: - buzz (AudioServices — most reliable hardware path for smoke test)

    @objc public func buzz(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        onMain {
            // 1519/1520/1521 = peek/pop/nolimited; kSystemSoundID_Vibrate = 4095
            switch style {
            case "light":
                AudioServicesPlaySystemSound(1519)
            case "heavy":
                AudioServicesPlaySystemSound(1521)
                AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
            default:
                AudioServicesPlaySystemSound(1520)
            }
            call.resolve(["ok": true, "path": "AudioServices", "style": style])
        }
    }

    // MARK: - impact (UIKit — must run on main, generators retained)

    @objc public func impact(_ call: CAPPluginCall) {
        let style = call.getString("style") ?? "medium"
        // Optional 0…1 — maps to UIImpact intensity (default 1). Tunable from JS.
        let intensity = CGFloat(max(0, min(1, call.getFloat("intensity") ?? 1.0)))
        // Optional extra hardware buzz (off by default — was masking param tuning)
        let withBuzz = call.getBool("withBuzz") ?? false
        onMain {
            let gen: UIImpactFeedbackGenerator
            switch style {
            case "light":  gen = self.impactLight
            case "heavy":  gen = self.impactHeavy
            case "soft":   gen = self.impactSoft
            case "rigid":  gen = self.impactRigid
            default:       gen = self.impactMedium
            }
            gen.prepare()
            if #available(iOS 13.0, *) {
                gen.impactOccurred(intensity: intensity)
            } else {
                gen.impactOccurred()
            }
            if withBuzz {
                AudioServicesPlaySystemSound(1519)
            }
            call.resolve([
                "ok": true,
                "path": "UIKit",
                "style": style,
                "intensity": Double(intensity),
            ])
        }
    }

    // MARK: - notification

    @objc public func notification(_ call: CAPPluginCall) {
        let type = call.getString("type") ?? "success"
        onMain {
            let t: UINotificationFeedbackGenerator.FeedbackType
            switch type {
            case "warning": t = .warning
            case "error":   t = .error
            default:        t = .success
            }
            self.notificationGen.prepare()
            self.notificationGen.notificationOccurred(t)
            call.resolve(["ok": true, "type": type])
        }
    }

    // MARK: - selection

    @objc public func selection(_ call: CAPPluginCall) {
        onMain {
            self.selectionGen.prepare()
            self.selectionGen.selectionChanged()
            call.resolve(["ok": true])
        }
    }

    // MARK: - Core Haptics helpers

    private func playTransient(intensity: Float, sharpness: Float) throws {
        try ensureEngineRunning()
        guard let engine = engine else {
            throw NSError(domain: "AdvancedHaptics", code: -1, userInfo: [NSLocalizedDescriptionKey: "Engine nil"])
        }
        let event = CHHapticEvent(
            eventType: .hapticTransient,
            parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
            ],
            relativeTime: 0
        )
        let pattern = try CHHapticPattern(events: [event], parameters: [])
        let player = try engine.makePlayer(with: pattern)
        try player.start(atTime: CHHapticTimeImmediate)
    }

    // MARK: - playPattern

    @objc public func playPattern(_ call: CAPPluginCall) {
        guard let events = call.getArray("events") as? [JSObject] else {
            call.reject("Missing 'events' array")
            return
        }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            call.reject("Haptics not supported on this device")
            return
        }

        do {
            try ensureEngineRunning()

            var hapticEvents: [CHHapticEvent] = []
            for event in events {
                let type = event["type"] as? String ?? "transient"
                let time = event["relativeTime"] as? Double ?? event["time"] as? Double ?? 0
                let duration = event["duration"] as? Double ?? 0.1
                let intensity = (event["intensity"] as? Double).map { Float($0) } ?? 0.5
                let sharpness = (event["sharpness"] as? Double).map { Float($0) } ?? 0.5

                var eventParams: [CHHapticEventParameter] = [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                ]

                let adsrMapping: [String: CHHapticEvent.ParameterID] = [
                    "attackTime": .attackTime,
                    "decayTime": .decayTime,
                    "releaseTime": .releaseTime
                ]
                for (key, id) in adsrMapping {
                    if let val = event[key] as? Double {
                        eventParams.append(CHHapticEventParameter(parameterID: id, value: Float(val)))
                    }
                }

                let eventType: CHHapticEvent.EventType =
                    (type == "continuous") ? .hapticContinuous : .hapticTransient
                hapticEvents.append(
                    CHHapticEvent(
                        eventType: eventType,
                        parameters: eventParams,
                        relativeTime: time,
                        duration: duration
                    )
                )
            }

            var hapticCurves: [CHHapticParameterCurve] = []
            if let curves = call.getArray("parameterCurves") as? [JSObject] {
                for curve in curves {
                    let paramIDStr = curve["parameterID"] as? String ?? "hapticIntensity"
                    let paramID: CHHapticDynamicParameter.ID =
                        (paramIDStr == "hapticSharpness")
                        ? .hapticSharpnessControl : .hapticIntensityControl
                    let relativeTime = curve["relativeTime"] as? Double ?? 0
                    guard let jspoints = curve["controlPoints"] as? [JSObject]
                        ?? curve["points"] as? [JSObject]
                    else { continue }
                    var points: [CHHapticParameterCurve.ControlPoint] = []
                    for pt in jspoints {
                        let t = pt["relativeTime"] as? Double ?? pt["time"] as? Double ?? 0
                        let v = (pt["parameterValue"] as? Double ?? pt["value"] as? Double)
                            .map { Float($0) } ?? 0.5
                        points.append(
                            CHHapticParameterCurve.ControlPoint(relativeTime: t, value: v)
                        )
                    }
                    hapticCurves.append(
                        CHHapticParameterCurve(
                            parameterID: paramID,
                            controlPoints: points,
                            relativeTime: relativeTime
                        )
                    )
                }
            }

            let pattern = try CHHapticPattern(events: hapticEvents, parameterCurves: hapticCurves)
            let player = try engine?.makePlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)
            call.resolve()
        } catch {
            call.reject("Failed to play pattern: \(error.localizedDescription)")
        }
    }

    // MARK: - stackImpact

    @objc public func stackImpact(_ call: CAPPluginCall) {
        let intensity = call.getFloat("intensity") ?? 0.25
        let sharpness = call.getFloat("sharpness") ?? 0.15

        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            // Fallback: UIKit
            onMain {
                self.impactMedium.prepare()
                self.impactMedium.impactOccurred(intensity: CGFloat(max(0.1, min(1, intensity))))
                AudioServicesPlaySystemSound(1519)
                call.resolve(["ok": true, "fallback": "uikit"])
            }
            return
        }

        do {
            try playTransient(intensity: intensity, sharpness: sharpness)
            call.resolve(["ok": true, "path": "coreHaptics"])
        } catch {
            onMain {
                self.impactMedium.prepare()
                self.impactMedium.impactOccurred(intensity: 1.0)
                AudioServicesPlaySystemSound(1519)
                call.resolve(["ok": true, "fallback": "uikit", "error": error.localizedDescription])
            }
        }
    }

    // MARK: - startContinuousHaptic

    @objc public func startContinuousHaptic(_ call: CAPPluginCall) {
        let intensity = max(0, min(1, call.getFloat("intensity") ?? 0.25))
        let sharpness = max(0, min(1, call.getFloat("sharpness") ?? 0.3))
        let duration = min(call.getDouble("duration") ?? 30.0, 30.0)

        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            call.reject("Haptics not supported")
            return
        }

        do {
            try ensureEngineRunning()

            if let prev = continuousPlayer {
                try? prev.stop(atTime: CHHapticTimeImmediate)
                continuousPlayer = nil
            }

            let event = CHHapticEvent(
                eventType: .hapticContinuous,
                parameters: [
                    CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                    CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness)
                ],
                relativeTime: 0,
                duration: duration
            )
            let pattern = try CHHapticPattern(events: [event], parameters: [])
            let player = try engine?.makeAdvancedPlayer(with: pattern)
            try player?.start(atTime: CHHapticTimeImmediate)
            continuousPlayer = player
            call.resolve(["ok": true, "intensity": intensity, "duration": duration])
        } catch {
            call.reject("Failed to start continuous haptic: \(error.localizedDescription)")
        }
    }

    // MARK: - updateContinuousHaptic

    @objc public func updateContinuousHaptic(_ call: CAPPluginCall) {
        let intensity = max(0, min(1, call.getFloat("intensity") ?? 0.25))
        let sharpness = max(0, min(1, call.getFloat("sharpness") ?? 0.3))

        guard let player = continuousPlayer else {
            call.resolve(["ok": false, "reason": "no_player"])
            return
        }
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
            call.resolve(["ok": false, "reason": "unsupported"])
            return
        }

        do {
            let params = [
                CHHapticDynamicParameter(
                    parameterID: .hapticIntensityControl, value: intensity, relativeTime: 0),
                CHHapticDynamicParameter(
                    parameterID: .hapticSharpnessControl, value: sharpness, relativeTime: 0)
            ]
            try player.sendParameters(params, atTime: CHHapticTimeImmediate)
            call.resolve(["ok": true, "intensity": intensity, "sharpness": sharpness])
        } catch {
            call.reject("Failed to update continuous haptic: \(error.localizedDescription)")
        }
    }

    // MARK: - setKeepAwake

    @objc public func setKeepAwake(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = enabled
            call.resolve(["enabled": enabled])
        }
    }

    // MARK: - stopContinuousHaptic

    @objc public func stopContinuousHaptic(_ call: CAPPluginCall) {
        if let player = continuousPlayer {
            do {
                let fadeParam = CHHapticDynamicParameter(
                    parameterID: .hapticIntensityControl, value: 0, relativeTime: 0)
                try player.sendParameters([fadeParam], atTime: CHHapticTimeImmediate)
                let capturedPlayer = player
                self.continuousPlayer = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    do {
                        try capturedPlayer.stop(atTime: CHHapticTimeImmediate)
                    } catch {
                        CAPLog.print("⚡️ AdvancedHaptics delayed stop error: \(error)")
                    }
                }
            } catch {
                try? player.stop(atTime: CHHapticTimeImmediate)
                self.continuousPlayer = nil
            }
        }
        call.resolve(["ok": true])
    }
}

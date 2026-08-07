import UIKit
import Capacitor

/// Registers local plugins and locks portrait orientation.
@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        registerLocalPlugins()
    }

    /// Also cover paths that recreate the bridge after load.
    override func viewDidLoad() {
        super.viewDidLoad()
        registerLocalPlugins()
    }

    private func registerLocalPlugins() {
        guard let bridge = bridge else {
            CAPLog.print("⚡️ AdvancedHaptics: bridge nil, skip register")
            return
        }
        // Idempotent: Capacitor overwrites same jsName if already present
        bridge.registerPluginInstance(AdvancedHapticsPlugin())
        CAPLog.print("⚡️ AdvancedHapticsPlugin registered (jsName=AdvancedHaptics)")
    }
}


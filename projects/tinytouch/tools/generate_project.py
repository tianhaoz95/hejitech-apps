#!/usr/bin/env python3
import os
import sys
import re

def get_existing_development_team(default_team="68CTFST8W2"):
    pbx_path = "ToddlerPlay.xcodeproj/project.pbxproj"
    if os.path.exists(pbx_path):
        try:
            with open(pbx_path, "r") as f:
                content = f.read()
            match = re.search(r'DEVELOPMENT_TEAM\s*=\s*([A-Z0-9]+);', content)
            if match:
                return match.group(1)
            match2 = re.search(r'DevelopmentTeam\s*=\s*([A-Z0-9]+);', content)
            if match2:
                return match2.group(1)
        except Exception:
            pass
    return os.environ.get("DEVELOPMENT_TEAM", default_team)

def generate_project(ios_sources, ios_resources, watch_sources, watch_resources, widget_sources=None, widget_resources=None):
    if widget_sources is None: widget_sources = []
    if widget_resources is None: widget_resources = []
    
    dev_team = get_existing_development_team()
    
    os.makedirs("ToddlerPlay.xcodeproj/xcshareddata/xcschemes", exist_ok=True)
    
    # Predictable IDs
    proj_id = "000100010001000100010001"
    
    ios_target_id = "000200020002000200020002"
    watch_target_id = "000300030003000300030003"
    widget_target_id = "002100210021002100210021"
    
    main_group_id = "000400040004000400040004"
    ios_group_id = "000500050005000500050005"
    watch_group_id = "000600060006000600060006"
    widget_group_id = "002D002D002D002D002D002D"
    products_group_id = "000700070007000700070007"
    
    ios_sources_group_id = "000800080008000800080008"
    ios_resources_group_id = "000900090009000900090009"
    watch_sources_group_id = "000A000A000A000A000A000A"
    watch_resources_group_id = "000B000B000B000B000B000B"
    
    ios_app_product_id = "000C000C000C000C000C000C"
    watch_app_product_id = "000D000D000D000D000D000D"
    widget_product_id = "002200220022002200220022"
    
    ios_sources_phase_id = "000E000E000E000E000E000E"
    ios_frameworks_phase_id = "000F000F000F000F000F000F"
    ios_resources_phase_id = "001000100010001000100010"
    embed_watch_phase_id = "001100110011001100110011"
    
    watch_sources_phase_id = "001200120012001200120012"
    watch_frameworks_phase_id = "001300130013001300130013"
    watch_resources_phase_id = "001400140014001400140014"
    embed_widget_phase_id = "002600260026002600260026"
    
    widget_sources_phase_id = "002300230023002300230023"
    widget_frameworks_phase_id = "002400240024002400240024"
    widget_resources_phase_id = "002500250025002500250025"
    
    watch_proxy_id = "001500150015001500150015"
    watch_dep_id = "001600160016001600160016"
    watch_embed_build_file_id = "001700170017001700170017"
    
    widget_proxy_id = "002700270027002700270027"
    widget_dep_id = "002800280028002800280028"
    widget_embed_build_file_id = "002900290029002900290029"
    widget_info_plist_ref = "002F002F002F002F002F002F"
    
    proj_cfg_list_id = "001800180018001800180018"
    proj_debug_cfg_id = "001900190019001900190019"
    proj_release_cfg_id = "001A001A001A001A001A001A"
    
    ios_cfg_list_id = "001B001B001B001B001B001B"
    ios_debug_cfg_id = "001C001C001C001C001C001C"
    ios_release_cfg_id = "001D001D001D001D001D001D"
    
    watch_cfg_list_id = "001E001E001E001E001E001E"
    watch_debug_cfg_id = "001F001F001F001F001F001F"
    watch_release_cfg_id = "002000200020002000200020"
    
    widget_cfg_list_id = "002A002A002A002A002A002A"
    widget_debug_cfg_id = "002B002B002B002B002B002B"
    widget_release_cfg_id = "002C002C002C002C002C002C"
    
    id_counter = 0x200
    def next_id():
        nonlocal id_counter
        id_counter += 1
        return f"{id_counter:024X}"
    
    ios_file_entries = []
    for f in ios_sources:
        ios_file_entries.append((next_id(), next_id(), os.path.basename(f), f, True, False))
    for f in ios_resources:
        ios_file_entries.append((next_id(), next_id(), os.path.basename(f), f, False, True))
        
    watch_file_entries = []
    for f in watch_sources:
        watch_file_entries.append((next_id(), next_id(), os.path.basename(f), f, True, False))
    for f in watch_resources:
        watch_file_entries.append((next_id(), next_id(), os.path.basename(f), f, False, True))
        
    widget_file_entries = []
    for f in widget_sources:
        widget_file_entries.append((next_id(), next_id(), os.path.basename(f), f, True, False))
    for f in widget_resources:
        widget_file_entries.append((next_id(), next_id(), os.path.basename(f), f, False, True))
        
    pbx = []
    pbx.append("// !$*UTF8*$!")
    pbx.append("{")
    pbx.append("\tarchiveVersion = 1;")
    pbx.append("\tclasses = {")
    pbx.append("\t};")
    pbx.append("\tobjectVersion = 56;")
    pbx.append("\tobjects = {")
    
    # PBXBuildFile section
    pbx.append("/* Begin PBXBuildFile section */")
    pbx.append(f"\t\t{watch_embed_build_file_id} /* ToddlerPlay.app in Embed Watch Content */ = {{isa = PBXBuildFile; fileRef = {watch_app_product_id} /* ToddlerPlay.app */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};")
    pbx.append(f"\t\t{widget_embed_build_file_id} /* TinyTouchWidget.appex in Embed App Extensions */ = {{isa = PBXBuildFile; fileRef = {widget_product_id} /* TinyTouchWidget.appex */; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};")
    
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries:
        if is_src:
            pbx.append(f"\t\t{b_ref} /* {fname} in Sources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
        elif is_res:
            pbx.append(f"\t\t{b_ref} /* {fname} in Resources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
            
    for f_ref, b_ref, fname, fpath, is_src, is_res in watch_file_entries:
        if is_src:
            pbx.append(f"\t\t{b_ref} /* {fname} in Sources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
        elif is_res:
            pbx.append(f"\t\t{b_ref} /* {fname} in Resources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
            
    for f_ref, b_ref, fname, fpath, is_src, is_res in widget_file_entries:
        if is_src:
            pbx.append(f"\t\t{b_ref} /* {fname} in Sources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
        elif is_res:
            pbx.append(f"\t\t{b_ref} /* {fname} in Resources */ = {{isa = PBXBuildFile; fileRef = {f_ref} /* {fname} */; }};")
    pbx.append("/* End PBXBuildFile section */")
    pbx.append("")
    
    # PBXContainerItemProxy section
    pbx.append("/* Begin PBXContainerItemProxy section */")
    pbx.append(f"\t\t{watch_proxy_id} /* PBXContainerItemProxy */ = {{")
    pbx.append("\t\t\tisa = PBXContainerItemProxy;")
    pbx.append(f"\t\t\tcontainerPortal = {proj_id} /* Project object */;")
    pbx.append("\t\t\tproxyType = 1;")
    pbx.append(f"\t\t\tremoteGlobalIDString = {watch_target_id};")
    pbx.append("\t\t\tremoteInfo = ToddlerPlay;")
    pbx.append("\t\t};")
    pbx.append(f"\t\t{widget_proxy_id} /* PBXContainerItemProxy */ = {{")
    pbx.append("\t\t\tisa = PBXContainerItemProxy;")
    pbx.append(f"\t\t\tcontainerPortal = {proj_id} /* Project object */;")
    pbx.append("\t\t\tproxyType = 1;")
    pbx.append(f"\t\t\tremoteGlobalIDString = {widget_target_id};")
    pbx.append("\t\t\tremoteInfo = TinyTouchWidget;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXContainerItemProxy section */")
    pbx.append("")
    
    # PBXCopyFilesBuildPhase section
    pbx.append("/* Begin PBXCopyFilesBuildPhase section */")
    # Phase 1: Embed Watch inside iOS App
    pbx.append(f"\t\t{embed_watch_phase_id} /* Embed Watch Content */ = {{")
    pbx.append("\t\t\tisa = PBXCopyFilesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tdstPath = \"$(CONTENTS_FOLDER_PATH)/Watch\";")
    pbx.append("\t\t\tdstSubfolderSpec = 16;")
    pbx.append("\t\t\tfiles = (")
    pbx.append(f"\t\t\t\t{watch_embed_build_file_id} /* ToddlerPlay.app in Embed Watch Content */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = \"Embed Watch Content\";")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    # Phase 2: Embed Widget Extension inside Watch App
    pbx.append(f"\t\t{embed_widget_phase_id} /* Embed App Extensions */ = {{")
    pbx.append("\t\t\tisa = PBXCopyFilesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tdstPath = \"\";")
    pbx.append("\t\t\tdstSubfolderSpec = 13;")
    pbx.append("\t\t\tfiles = (")
    pbx.append(f"\t\t\t\t{widget_embed_build_file_id} /* TinyTouchWidget.appex in Embed App Extensions */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = \"Embed App Extensions\";")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXCopyFilesBuildPhase section */")
    pbx.append("")
    
    # PBXFileReference section
    pbx.append("/* Begin PBXFileReference section */")
    pbx.append(f"\t\t{ios_app_product_id} /* TinyTouch.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = TinyTouch.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    pbx.append(f"\t\t{watch_app_product_id} /* ToddlerPlay.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ToddlerPlay.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    pbx.append(f"\t\t{widget_product_id} /* TinyTouchWidget.appex */ = {{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; path = TinyTouchWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};")
    
    def get_ft(fname):
        if fname.endswith(".swift"): return "sourcecode.swift"
        if fname.endswith(".xcassets"): return "folder.assetcatalog"
        if fname.endswith(".wav"): return "audio.wav"
        if fname.endswith(".xcprivacy"): return "text.xml"
        if fname.endswith(".plist"): return "text.plist.xml"
        return "text"
        
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries + watch_file_entries + widget_file_entries:
        ft = get_ft(fname)
        pbx.append(f"\t\t{f_ref} /* {fname} */ = {{isa = PBXFileReference; lastKnownFileType = {ft}; path = \"{fpath}\"; sourceTree = \"<group>\"; }};")
    pbx.append(f"\t\t{widget_info_plist_ref} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = \"TinyTouchWidget/Info.plist\"; sourceTree = \"<group>\"; }};")
    pbx.append("/* End PBXFileReference section */")
    pbx.append("")
    
    # PBXFrameworksBuildPhase
    pbx.append("/* Begin PBXFrameworksBuildPhase section */")
    pbx.append(f"\t\t{ios_frameworks_phase_id} /* Frameworks */ = {{")
    pbx.append("\t\t\tisa = PBXFrameworksBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = ();")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append(f"\t\t{watch_frameworks_phase_id} /* Frameworks */ = {{")
    pbx.append("\t\t\tisa = PBXFrameworksBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = ();")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append(f"\t\t{widget_frameworks_phase_id} /* Frameworks */ = {{")
    pbx.append("\t\t\tisa = PBXFrameworksBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = ();")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXFrameworksBuildPhase section */")
    pbx.append("")
    
    # PBXGroup section
    pbx.append("/* Begin PBXGroup section */")
    pbx.append(f"\t\t{main_group_id} = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    pbx.append(f"\t\t\t\t{ios_group_id} /* TinyTouchiOS */,")
    pbx.append(f"\t\t\t\t{watch_group_id} /* ToddlerPlay */,")
    pbx.append(f"\t\t\t\t{widget_group_id} /* TinyTouchWidget */,")
    pbx.append(f"\t\t\t\t{products_group_id} /* Products */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    # iOS group
    pbx.append(f"\t\t{ios_group_id} /* TinyTouchiOS */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    pbx.append(f"\t\t\t\t{ios_sources_group_id} /* Sources */,")
    pbx.append(f"\t\t\t\t{ios_resources_group_id} /* Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = TinyTouchiOS;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{ios_sources_group_id} /* Sources */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries:
        if is_src: pbx.append(f"\t\t\t\t{f_ref} /* {fname} */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = Sources;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{ios_resources_group_id} /* Resources */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries:
        if is_res: pbx.append(f"\t\t\t\t{f_ref} /* {fname} */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = Resources;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    # Watch group
    pbx.append(f"\t\t{watch_group_id} /* ToddlerPlay */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    pbx.append(f"\t\t\t\t{watch_sources_group_id} /* Sources */,")
    pbx.append(f"\t\t\t\t{watch_resources_group_id} /* Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = ToddlerPlay;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{watch_sources_group_id} /* Sources */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in watch_file_entries:
        if is_src: pbx.append(f"\t\t\t\t{f_ref} /* {fname} */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = Sources;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{watch_resources_group_id} /* Resources */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in watch_file_entries:
        if is_res: pbx.append(f"\t\t\t\t{f_ref} /* {fname} */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = Resources;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    # Widget group
    pbx.append(f"\t\t{widget_group_id} /* TinyTouchWidget */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in widget_file_entries:
        pbx.append(f"\t\t\t\t{f_ref} /* {fname} */,")
    pbx.append(f"\t\t\t\t{widget_info_plist_ref} /* Info.plist */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = TinyTouchWidget;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    
    # Products group
    pbx.append(f"\t\t{products_group_id} /* Products */ = {{")
    pbx.append("\t\t\tisa = PBXGroup;")
    pbx.append("\t\t\tchildren = (")
    pbx.append(f"\t\t\t\t{ios_app_product_id} /* TinyTouch.app */,")
    pbx.append(f"\t\t\t\t{watch_app_product_id} /* ToddlerPlay.app */,")
    pbx.append(f"\t\t\t\t{widget_product_id} /* TinyTouchWidget.appex */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = Products;")
    pbx.append("\t\t\tsourceTree = \"<group>\";")
    pbx.append("\t\t};")
    pbx.append("/* End PBXGroup section */")
    pbx.append("")
    
    # PBXNativeTarget section
    pbx.append("/* Begin PBXNativeTarget section */")
    # iOS Target
    pbx.append(f"\t\t{ios_target_id} /* TinyTouch */ = {{")
    pbx.append("\t\t\tisa = PBXNativeTarget;")
    pbx.append(f"\t\t\tbuildConfigurationList = {ios_cfg_list_id} /* Build configuration list for PBXNativeTarget \"TinyTouch\" */;")
    pbx.append("\t\t\tbuildPhases = (")
    pbx.append(f"\t\t\t\t{ios_sources_phase_id} /* Sources */,")
    pbx.append(f"\t\t\t\t{ios_frameworks_phase_id} /* Frameworks */,")
    pbx.append(f"\t\t\t\t{ios_resources_phase_id} /* Resources */,")
    pbx.append(f"\t\t\t\t{embed_watch_phase_id} /* Embed Watch Content */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tbuildRules = ();")
    pbx.append("\t\t\tdependencies = (")
    pbx.append(f"\t\t\t\t{watch_dep_id} /* PBXTargetDependency */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = TinyTouch;")
    pbx.append("\t\t\tproductName = TinyTouch;")
    pbx.append(f"\t\t\tproductReference = {ios_app_product_id} /* TinyTouch.app */;")
    pbx.append("\t\t\tproductType = \"com.apple.product-type.application\";")
    pbx.append("\t\t};")
    
    # Watch Target (Embeds Widget Extension)
    pbx.append(f"\t\t{watch_target_id} /* ToddlerPlay */ = {{")
    pbx.append("\t\t\tisa = PBXNativeTarget;")
    pbx.append(f"\t\t\tbuildConfigurationList = {watch_cfg_list_id} /* Build configuration list for PBXNativeTarget \"ToddlerPlay\" */;")
    pbx.append("\t\t\tbuildPhases = (")
    pbx.append(f"\t\t\t\t{watch_sources_phase_id} /* Sources */,")
    pbx.append(f"\t\t\t\t{watch_frameworks_phase_id} /* Frameworks */,")
    pbx.append(f"\t\t\t\t{watch_resources_phase_id} /* Resources */,")
    pbx.append(f"\t\t\t\t{embed_widget_phase_id} /* Embed App Extensions */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tbuildRules = ();")
    pbx.append("\t\t\tdependencies = (")
    pbx.append(f"\t\t\t\t{widget_dep_id} /* PBXTargetDependency */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tname = ToddlerPlay;")
    pbx.append("\t\t\tproductName = ToddlerPlay;")
    pbx.append(f"\t\t\tproductReference = {watch_app_product_id} /* ToddlerPlay.app */;")
    pbx.append("\t\t\tproductType = \"com.apple.product-type.application\";")
    pbx.append("\t\t};")
    
    # Widget Extension Target
    pbx.append(f"\t\t{widget_target_id} /* TinyTouchWidget */ = {{")
    pbx.append("\t\t\tisa = PBXNativeTarget;")
    pbx.append(f"\t\t\tbuildConfigurationList = {widget_cfg_list_id} /* Build configuration list for PBXNativeTarget \"TinyTouchWidget\" */;")
    pbx.append("\t\t\tbuildPhases = (")
    pbx.append(f"\t\t\t\t{widget_sources_phase_id} /* Sources */,")
    pbx.append(f"\t\t\t\t{widget_frameworks_phase_id} /* Frameworks */,")
    pbx.append(f"\t\t\t\t{widget_resources_phase_id} /* Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tbuildRules = ();")
    pbx.append("\t\t\tdependencies = ();")
    pbx.append("\t\t\tname = TinyTouchWidget;")
    pbx.append("\t\t\tproductName = TinyTouchWidget;")
    pbx.append(f"\t\t\tproductReference = {widget_product_id} /* TinyTouchWidget.appex */;")
    pbx.append("\t\t\tproductType = \"com.apple.product-type.app-extension\";")
    pbx.append("\t\t};")
    pbx.append("/* End PBXNativeTarget section */")
    pbx.append("")
    
    # PBXProject section
    pbx.append("/* Begin PBXProject section */")
    pbx.append(f"\t\t{proj_id} /* Project object */ = {{")
    pbx.append("\t\t\tisa = PBXProject;")
    pbx.append("\t\t\tattributes = {")
    pbx.append("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    pbx.append("\t\t\t\tLastUpgradeCheck = 1500;")
    pbx.append("\t\t\t\tTargetAttributes = {")
    pbx.append(f"\t\t\t\t\t{ios_target_id} = {{")
    pbx.append("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    pbx.append(f"\t\t\t\t\t\tDevelopmentTeam = {dev_team};")
    pbx.append("\t\t\t\t\t\tProvisioningStyle = Automatic;")
    pbx.append("\t\t\t\t\t};")
    pbx.append(f"\t\t\t\t\t{watch_target_id} = {{")
    pbx.append("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    pbx.append(f"\t\t\t\t\t\tDevelopmentTeam = {dev_team};")
    pbx.append("\t\t\t\t\t\tProvisioningStyle = Automatic;")
    pbx.append("\t\t\t\t\t};")
    pbx.append(f"\t\t\t\t\t{widget_target_id} = {{")
    pbx.append("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    pbx.append(f"\t\t\t\t\t\tDevelopmentTeam = {dev_team};")
    pbx.append("\t\t\t\t\t\tProvisioningStyle = Automatic;")
    pbx.append("\t\t\t\t\t};")
    pbx.append("\t\t\t\t};")
    pbx.append("\t\t\t};")
    pbx.append(f"\t\t\tbuildConfigurationList = {proj_cfg_list_id} /* Build configuration list for PBXProject \"ToddlerPlay\" */;")
    pbx.append("\t\t\tcompatibilityVersion = \"Xcode 14.0\";")
    pbx.append("\t\t\tdevelopmentRegion = en;")
    pbx.append("\t\t\thasScannedForEncodings = 0;")
    pbx.append("\t\t\tknownRegions = (")
    pbx.append("\t\t\t\ten,")
    pbx.append("\t\t\t\tBase,")
    pbx.append("\t\t\t);")
    pbx.append(f"\t\t\tmainGroup = {main_group_id};")
    pbx.append(f"\t\t\tproductRefGroup = {products_group_id} /* Products */;")
    pbx.append("\t\t\tprojectDirPath = \"\";")
    pbx.append("\t\t\tprojectRoot = \"\";")
    pbx.append("\t\t\ttargets = (")
    pbx.append(f"\t\t\t\t{ios_target_id} /* TinyTouch */,")
    pbx.append(f"\t\t\t\t{watch_target_id} /* ToddlerPlay */,")
    pbx.append(f"\t\t\t\t{widget_target_id} /* TinyTouchWidget */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t};")
    pbx.append("/* End PBXProject section */")
    pbx.append("")
    
    # PBXResourcesBuildPhase
    pbx.append("/* Begin PBXResourcesBuildPhase section */")
    pbx.append(f"\t\t{ios_resources_phase_id} /* Resources */ = {{")
    pbx.append("\t\t\tisa = PBXResourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries:
        if is_res: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{watch_resources_phase_id} /* Resources */ = {{")
    pbx.append("\t\t\tisa = PBXResourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in watch_file_entries:
        if is_res: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{widget_resources_phase_id} /* Resources */ = {{")
    pbx.append("\t\t\tisa = PBXResourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in widget_file_entries:
        if is_res: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Resources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXResourcesBuildPhase section */")
    pbx.append("")
    
    # PBXSourcesBuildPhase
    pbx.append("/* Begin PBXSourcesBuildPhase section */")
    pbx.append(f"\t\t{ios_sources_phase_id} /* Sources */ = {{")
    pbx.append("\t\t\tisa = PBXSourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in ios_file_entries:
        if is_src: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Sources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{watch_sources_phase_id} /* Sources */ = {{")
    pbx.append("\t\t\tisa = PBXSourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in watch_file_entries:
        if is_src: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Sources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{widget_sources_phase_id} /* Sources */ = {{")
    pbx.append("\t\t\tisa = PBXSourcesBuildPhase;")
    pbx.append("\t\t\tbuildActionMask = 2147483647;")
    pbx.append("\t\t\tfiles = (")
    for f_ref, b_ref, fname, fpath, is_src, is_res in widget_file_entries:
        if is_src: pbx.append(f"\t\t\t\t{b_ref} /* {fname} in Sources */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXSourcesBuildPhase section */")
    pbx.append("")
    
    # PBXTargetDependency section
    pbx.append("/* Begin PBXTargetDependency section */")
    pbx.append(f"\t\t{watch_dep_id} /* PBXTargetDependency */ = {{")
    pbx.append("\t\t\tisa = PBXTargetDependency;")
    pbx.append(f"\t\t\ttarget = {watch_target_id} /* ToddlerPlay */;")
    pbx.append(f"\t\t\ttargetProxy = {watch_proxy_id} /* PBXContainerItemProxy */;")
    pbx.append("\t\t};")
    pbx.append(f"\t\t{widget_dep_id} /* PBXTargetDependency */ = {{")
    pbx.append("\t\t\tisa = PBXTargetDependency;")
    pbx.append(f"\t\t\ttarget = {widget_target_id} /* TinyTouchWidget */;")
    pbx.append(f"\t\t\ttargetProxy = {widget_proxy_id} /* PBXContainerItemProxy */;")
    pbx.append("\t\t};")
    pbx.append("/* End PBXTargetDependency section */")
    pbx.append("")
    
    # XCBuildConfiguration section
    pbx.append("/* Begin XCBuildConfiguration section */")
    # Project Debug
    pbx.append(f"\t\t{proj_debug_cfg_id} /* Debug */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    pbx.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    pbx.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
    pbx.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    pbx.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
    pbx.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    pbx.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;")
    pbx.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
    pbx.append("\t\t\t\tENABLE_TESTABILITY = YES;")
    pbx.append("\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;")
    pbx.append("\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (")
    pbx.append("\t\t\t\t\t\"DEBUG=1\",")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;")
    pbx.append("\t\t\t\tMTL_FAST_MATH = YES;")
    pbx.append("\t\t\t\tONLY_ACTIVE_ARCH = YES;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Debug;")
    pbx.append("\t\t};")
    
    # Project Release
    pbx.append(f"\t\t{proj_release_cfg_id} /* Release */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    pbx.append("\t\t\t\tCLANG_ANALYZER_NONNULL = YES;")
    pbx.append("\t\t\t\tCLANG_CXX_LANGUAGE_STANDARD = \"gnu++20\";")
    pbx.append("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    pbx.append("\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;")
    pbx.append("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    pbx.append("\t\t\t\tDEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";")
    pbx.append("\t\t\t\tENABLE_NS_ASSERTIONS = NO;")
    pbx.append("\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;")
    pbx.append("\t\t\t\tGCC_OPTIMIZATION_LEVEL = s;")
    pbx.append("\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;")
    pbx.append("\t\t\t\tMTL_FAST_MATH = YES;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Release;")
    pbx.append("\t\t};")
    
    # iOS Target Debug
    pbx.append(f"\t\t{ios_debug_cfg_id} /* Debug */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = \"UIInterfaceOrientationPortrait\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
    pbx.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = iphoneos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = NO;")
    pbx.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG $(inherited)\";")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Debug;")
    pbx.append("\t\t};")
    
    # iOS Target Release
    pbx.append(f"\t\t{ios_release_cfg_id} /* Release */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = \"UIInterfaceOrientationPortrait\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight\";")
    pbx.append("\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = iphoneos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = NO;")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-O\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Release;")
    pbx.append("\t\t};")
    
    # Watch Target Debug
    pbx.append(f"\t\t{watch_debug_cfg_id} /* Debug */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKApplication = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKCompanionAppBundleIdentifier = \"com.tianhaoz.tinytouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKRunsIndependentlyOfCompanionApp = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKBackgroundModes = \"self-care\";")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch.watchkitapp;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = watchos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = YES;")
    pbx.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG $(inherited)\";")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = 4;")
    pbx.append("\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Debug;")
    pbx.append("\t\t};")
    
    # Watch Target Release
    pbx.append(f"\t\t{watch_release_cfg_id} /* Release */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;")
    pbx.append("\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations = \"UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKApplication = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKCompanionAppBundleIdentifier = \"com.tianhaoz.tinytouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKRunsIndependentlyOfCompanionApp = YES;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_WKBackgroundModes = \"self-care\";")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch.watchkitapp;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = watchos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = YES;")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-O\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = 4;")
    pbx.append("\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Release;")
    pbx.append("\t\t};")
    
    # Widget Target Debug
    pbx.append(f"\t\t{widget_debug_cfg_id} /* Debug */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_FILE = TinyTouchWidget/Info.plist;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_NSExtension_NSExtensionPointIdentifier = \"com.apple.widgetkit-extension\";")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t\t\"@executable_path/../../Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch.watchkitapp.widget;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = watchos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = YES;")
    pbx.append("\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = \"DEBUG $(inherited)\";")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = 4;")
    pbx.append("\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Debug;")
    pbx.append("\t\t};")
    
    # Widget Target Release
    pbx.append(f"\t\t{widget_release_cfg_id} /* Release */ = {{")
    pbx.append("\t\t\tisa = XCBuildConfiguration;")
    pbx.append("\t\t\tbuildSettings = {")
    pbx.append("\t\t\t\tCODE_SIGN_STYLE = Automatic;")
    pbx.append(f"\t\t\t\tDEVELOPMENT_TEAM = {dev_team};")
    pbx.append("\t\t\t\tENABLE_PREVIEWS = YES;")
    pbx.append("\t\t\t\tGENERATE_INFOPLIST_FILE = YES;")
    pbx.append("\t\t\t\tINFOPLIST_FILE = TinyTouchWidget/Info.plist;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleDisplayName = \"TinyTouch\";")
    pbx.append("\t\t\t\tINFOPLIST_KEY_NSExtension_NSExtensionPointIdentifier = \"com.apple.widgetkit-extension\";")
    pbx.append("\t\t\t\tMARKETING_VERSION = 1.5;")
    pbx.append("\t\t\t\tCURRENT_PROJECT_VERSION = 7;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleShortVersionString = 1.5;")
    pbx.append("\t\t\t\tINFOPLIST_KEY_CFBundleVersion = 7;")
    pbx.append("\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (")
    pbx.append("\t\t\t\t\t\"$(inherited)\",")
    pbx.append("\t\t\t\t\t\"@executable_path/Frameworks\",")
    pbx.append("\t\t\t\t\t\"@executable_path/../../Frameworks\",")
    pbx.append("\t\t\t\t);")
    pbx.append("\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.tianhaoz.tinytouch.watchkitapp.widget;")
    pbx.append("\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";")
    pbx.append("\t\t\t\tSDKROOT = watchos;")
    pbx.append("\t\t\t\tSKIP_INSTALL = YES;")
    pbx.append("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-O\";")
    pbx.append("\t\t\t\tSWIFT_VERSION = 5.0;")
    pbx.append("\t\t\t\tTARGETED_DEVICE_FAMILY = 4;")
    pbx.append("\t\t\t\tWATCHOS_DEPLOYMENT_TARGET = 10.0;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t\tname = Release;")
    pbx.append("\t\t};")
    pbx.append("/* End XCBuildConfiguration section */")
    pbx.append("")
    
    # XCConfigurationList section
    pbx.append("/* Begin XCConfigurationList section */")
    pbx.append(f"\t\t{proj_cfg_list_id} /* Build configuration list for PBXProject \"ToddlerPlay\" */ = {{")
    pbx.append("\t\t\tisa = XCConfigurationList;")
    pbx.append("\t\t\tbuildConfigurations = (")
    pbx.append(f"\t\t\t\t{proj_debug_cfg_id} /* Debug */,")
    pbx.append(f"\t\t\t\t{proj_release_cfg_id} /* Release */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx.append("\t\t\tdefaultConfigurationName = Release;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{ios_cfg_list_id} /* Build configuration list for PBXNativeTarget \"TinyTouch\" */ = {{")
    pbx.append("\t\t\tisa = XCConfigurationList;")
    pbx.append("\t\t\tbuildConfigurations = (")
    pbx.append(f"\t\t\t\t{ios_debug_cfg_id} /* Debug */,")
    pbx.append(f"\t\t\t\t{ios_release_cfg_id} /* Release */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx.append("\t\t\tdefaultConfigurationName = Release;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{watch_cfg_list_id} /* Build configuration list for PBXNativeTarget \"ToddlerPlay\" */ = {{")
    pbx.append("\t\t\tisa = XCConfigurationList;")
    pbx.append("\t\t\tbuildConfigurations = (")
    pbx.append(f"\t\t\t\t{watch_debug_cfg_id} /* Debug */,")
    pbx.append(f"\t\t\t\t{watch_release_cfg_id} /* Release */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx.append("\t\t\tdefaultConfigurationName = Release;")
    pbx.append("\t\t};")
    
    pbx.append(f"\t\t{widget_cfg_list_id} /* Build configuration list for PBXNativeTarget \"TinyTouchWidget\" */ = {{")
    pbx.append("\t\t\tisa = XCConfigurationList;")
    pbx.append("\t\t\tbuildConfigurations = (")
    pbx.append(f"\t\t\t\t{widget_debug_cfg_id} /* Debug */,")
    pbx.append(f"\t\t\t\t{widget_release_cfg_id} /* Release */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t\tdefaultConfigurationIsVisible = 0;")
    pbx.append("\t\t\tdefaultConfigurationName = Release;")
    pbx.append("\t\t};")
    pbx.append("/* End XCConfigurationList section */")
    pbx.append("")
    
    pbx.append("\t};")
    pbx.append(f"\trootObject = {proj_id} /* Project object */;")
    pbx.append("}")
    
    with open("ToddlerPlay.xcodeproj/project.pbxproj", "w") as f:
        f.write("\n".join(pbx) + "\n")
    print("Generated ToddlerPlay.xcodeproj/project.pbxproj")
    
    # Scheme 1: TinyTouch (iOS + Embedded Watch + Widget)
    scheme_ios = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1500"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{ios_target_id}"
               BuildableName = "TinyTouch.app"
               BlueprintName = "TinyTouch"
               ReferencedContainer = "container:ToddlerPlay.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{watch_target_id}"
               BuildableName = "ToddlerPlay.app"
               BlueprintName = "ToddlerPlay"
               ReferencedContainer = "container:ToddlerPlay.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{widget_target_id}"
               BuildableName = "TinyTouchWidget.appex"
               BlueprintName = "TinyTouchWidget"
               ReferencedContainer = "container:ToddlerPlay.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{ios_target_id}"
            BuildableName = "TinyTouch.app"
            BlueprintName = "TinyTouch"
            ReferencedContainer = "container:ToddlerPlay.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{ios_target_id}"
            BuildableName = "TinyTouch.app"
            BlueprintName = "TinyTouch"
            ReferencedContainer = "container:ToddlerPlay.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
    with open("ToddlerPlay.xcodeproj/xcshareddata/xcschemes/TinyTouch.xcscheme", "w") as f:
        f.write(scheme_ios)
    print("Generated scheme TinyTouch.xcscheme")

    # Scheme 2: ToddlerPlay (WatchOS Standalone/Testing + Widget)
    scheme_watch = f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1500"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{watch_target_id}"
               BuildableName = "ToddlerPlay.app"
               BlueprintName = "ToddlerPlay"
               ReferencedContainer = "container:ToddlerPlay.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{widget_target_id}"
               BuildableName = "TinyTouchWidget.appex"
               BlueprintName = "TinyTouchWidget"
               ReferencedContainer = "container:ToddlerPlay.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{watch_target_id}"
            BuildableName = "ToddlerPlay.app"
            BlueprintName = "ToddlerPlay"
            ReferencedContainer = "container:ToddlerPlay.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{watch_target_id}"
            BuildableName = "ToddlerPlay.app"
            BlueprintName = "ToddlerPlay"
            ReferencedContainer = "container:ToddlerPlay.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
    with open("ToddlerPlay.xcodeproj/xcshareddata/xcschemes/ToddlerPlay.xcscheme", "w") as f:
        f.write(scheme_watch)
    print("Generated scheme ToddlerPlay.xcscheme")

if __name__ == "__main__":
    # Collect iOS files
    ios_sources = []
    for root, _, files in os.walk("TinyTouchiOS/Sources"):
        for file in files:
            if file.endswith(".swift"):
                ios_sources.append(os.path.join(root, file))
    
    ios_resources = []
    if os.path.exists("TinyTouchiOS/Resources/Assets.xcassets"):
        ios_resources.append("TinyTouchiOS/Resources/Assets.xcassets")
    if os.path.exists("TinyTouchiOS/Resources/PrivacyInfo.xcprivacy"):
        ios_resources.append("TinyTouchiOS/Resources/PrivacyInfo.xcprivacy")
    for root, _, files in os.walk("TinyTouchiOS/Resources/Sounds"):
        for file in files:
            if file.endswith(".wav"):
                ios_resources.append(os.path.join(root, file))
                
    # Collect Watch files
    watch_sources = []
    for root, _, files in os.walk("ToddlerPlay/Sources"):
        for file in files:
            if file.endswith(".swift"):
                watch_sources.append(os.path.join(root, file))
                
    watch_resources = []
    if os.path.exists("ToddlerPlay/Resources/Assets.xcassets"):
        watch_resources.append("ToddlerPlay/Resources/Assets.xcassets")
    if os.path.exists("ToddlerPlay/Resources/PrivacyInfo.xcprivacy"):
        watch_resources.append("ToddlerPlay/Resources/PrivacyInfo.xcprivacy")
    for root, _, files in os.walk("ToddlerPlay/Resources/Sounds"):
        for file in files:
            if file.endswith(".wav"):
                watch_resources.append(os.path.join(root, file))
                
    # Collect Widget files
    widget_sources = []
    for root, _, files in os.walk("TinyTouchWidget"):
        for file in files:
            if file.endswith(".swift"):
                widget_sources.append(os.path.join(root, file))
                
    widget_resources = []
                
    generate_project(
        sorted(ios_sources), sorted(ios_resources),
        sorted(watch_sources), sorted(watch_resources),
        sorted(widget_sources), sorted(widget_resources)
    )

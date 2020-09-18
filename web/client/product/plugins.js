/**
 * Copyright 2016, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
  * Please, keep them sorted alphabetically
 */
module.exports = {
    plugins: {
        // product plugins
        AboutPlugin: require('./plugins/About'),
        AttributionPlugin: require('./plugins/Attribution'),
        ExamplesPlugin: require('./plugins/Examples'),
        FooterPlugin: require('./plugins/Footer'),
        ForkPlugin: require('./plugins/Fork'),
        HeaderPlugin: require('./plugins/Header'),
        HomeDescriptionPlugin: require('./plugins/HomeDescription'),
        MadeWithLovePlugin: require('./plugins/MadeWithLove'),
        MailingListsPlugin: require('./plugins/MailingLists'),
        MapTypePlugin: require('./plugins/MapType'),
        NavMenu: require('./plugins/NavMenu'),
        // framework plugins
        AddGroupPlugin: require('../plugins/AddGroup').default,
        AnnotationsPlugin: require('../plugins/Annotations'),
        AutoMapUpdatePlugin: require('../plugins/AutoMapUpdate'),
        BackgroundSelectorPlugin: require('../plugins/BackgroundSelector'),
        BackgroundSwitcherPlugin: require('../plugins/BackgroundSwitcher'),
        BurgerMenuPlugin: require('../plugins/BurgerMenu'),
        CRSSelectorPlugin: require('../plugins/CRSSelector'),
        ContentTabs: require('../plugins/ContentTabs'),
        ContextPlugin: require('../plugins/Context').default,
        ContextCreatorPlugin: require('../plugins/ContextCreator').default,
        ContextManagerPlugin: require('../plugins/contextmanager/ContextManager').default,
        CookiePlugin: require('../plugins/Cookie'),
        CreateNewMapPlugin: require('../plugins/CreateNewMap').default,
        Dashboard: require('../plugins/Dashboard'),
        DashboardEditor: require('../plugins/DashboardEditor'),
        DashboardsPlugin: require('../plugins/Dashboards'),
        DetailsPlugin: require('../plugins/Details'),
        DrawerMenuPlugin: require('../plugins/DrawerMenu'),
        ExpanderPlugin: require('../plugins/Expander'),
        FeatureEditorPlugin: require('../plugins/FeatureEditor').default,
        FeaturedMaps: require('../plugins/FeaturedMaps').default,
        FeedbackMaskPlugin: require('../plugins/FeedbackMask'),
        FilterLayerPlugin: require('../plugins/FilterLayer').default,
        FloatingLegendPlugin: require('../plugins/FloatingLegend'),
        FullScreenPlugin: require('../plugins/FullScreen'),
        GeoStoryPlugin: require('../plugins/GeoStory').default,
        GeoStoriesPlugin: require('../plugins/GeoStories'),
        GeoStoryEditorPlugin: require('../plugins/GeoStoryEditor').default,
        GeoStorySavePlugin: require('../plugins/GeoStorySave').GeoStorySave,
        GeoStorySaveAsPlugin: require('../plugins/GeoStorySave').GeoStorySaveAs,
        DashboardSavePlugin: require('../plugins/DashboardSave').DashboardSave,
        DashboardSaveAsPlugin: require('../plugins/DashboardSave').DashboardSaveAs,
        GeoStoryNavigationPlugin: require('../plugins/GeoStoryNavigation').default,
        GlobeViewSwitcherPlugin: require('../plugins/GlobeViewSwitcher'),
        GoFull: require('../plugins/GoFull'),
        GridContainerPlugin: require('../plugins/GridContainer'),
        GroupManagerPlugin: require('../plugins/manager/GroupManager'),
        HelpLinkPlugin: require('../plugins/HelpLink').default,
        HelpPlugin: require('../plugins/Help'),
        HomePlugin: require('../plugins/Home'),
        IdentifyPlugin: require('../plugins/Identify'),
        LanguagePlugin: require('../plugins/Language'),
        LayerInfoPlugin: require('../plugins/LayerInfo').default,
        LocatePlugin: require('../plugins/Locate'),
        LoginPlugin: require('../plugins/Login'),
        ManagerMenuPlugin: require('../plugins/manager/ManagerMenu'),
        ManagerPlugin: require('../plugins/manager/Manager'),
        MapEditorPlugin: require('../plugins/MapEditor').default,
        MapExportPlugin: require('../plugins/MapExport').default,
        MapFooterPlugin: require('../plugins/MapFooter'),
        MapImportPlugin: require('../plugins/MapImport'),
        MapLoadingPlugin: require('../plugins/MapLoading'),
        MapPlugin: require('../plugins/Map'),
        MapSearchPlugin: require('../plugins/MapSearch'),
        MapsPlugin: require('../plugins/Maps').default,
        MapCatalogPlugin: require('../plugins/MapCatalog').default,
        MapTemplatesPlugin: require('../plugins/MapTemplates').default,
        MeasurePlugin: require('../plugins/Measure'),
        MediaEditorPlugin: require('../plugins/MediaEditor').default,
        MetadataExplorerPlugin: require('../plugins/MetadataExplorer'),
        MousePositionPlugin: require('../plugins/MousePosition'),
        NotificationsPlugin: require('../plugins/Notifications'),
        OmniBarPlugin: require('../plugins/OmniBar'),
        PlaybackPlugin: require('../plugins/Playback.jsx'),
        PrintPlugin: require('../plugins/Print'),
        QueryPanelPlugin: require('../plugins/QueryPanel'),
        RedirectPlugin: require('../plugins/Redirect'),
        RedoPlugin: require('../plugins/History'),
        RulesDataGridPlugin: require('../plugins/RulesDataGrid'),
        RulesEditorPlugin: require('../plugins/RulesEditor'),
        RulesManagerFooter: require('../plugins/RulesManagerFooter'),
        SavePlugin: require('../plugins/Save').default,
        SaveAsPlugin: require('../plugins/SaveAs').default,
        SaveStoryPlugin: require('../plugins/GeoStorySave'),
        ScaleBoxPlugin: require('../plugins/ScaleBox'),
        ScrollTopPlugin: require('../plugins/ScrollTop'),
        SearchPlugin: require('../plugins/Search'),
        SearchServicesConfigPlugin: require('../plugins/SearchServicesConfig'),
        SearchByBookmarkPlugin: require('../plugins/SearchByBookmark').default,
        SettingsPlugin: require('../plugins/Settings'),
        SharePlugin: require('../plugins/Share'),
        SnapshotPlugin: require('../plugins/Snapshot'),
        StyleEditorPlugin: require('../plugins/StyleEditor'),
        TOCItemsSettingsPlugin: require('../plugins/TOCItemsSettings').default,
        SwipePlugin: require('../plugins/Swipe').default,
        TOCPlugin: require('../plugins/TOC'),
        ThematicLayerPlugin: require('../plugins/ThematicLayer'),
        ThemeSwitcherPlugin: require('../plugins/ThemeSwitcher'),
        TimelinePlugin: require('../plugins/Timeline'),
        ToolbarPlugin: require('../plugins/Toolbar'),
        TutorialPlugin: require('../plugins/Tutorial'),
        UndoPlugin: require('../plugins/History'),
        UserManagerPlugin: require('../plugins/manager/UserManager'),
        UserExtensionsPlugin: require('../plugins/UserExtensions').default,
        UserSessionPlugin: require('../plugins/UserSession').default,
        VersionPlugin: require('../plugins/Version'),
        WFSDownloadPlugin: require('../plugins/WFSDownload'),
        WidgetsBuilderPlugin: require('../plugins/WidgetsBuilder').default,
        WidgetsPlugin: require('../plugins/Widgets').default,
        WidgetsTrayPlugin: require('../plugins/WidgetsTray').default,
        ZoomAllPlugin: require('../plugins/ZoomAll'),
        ZoomInPlugin: require('../plugins/ZoomIn'),
        ZoomOutPlugin: require('../plugins/ZoomOut')
    },
    requires: {
        ReactSwipe: require('react-swipeable-views').default,
        SwipeHeader: require('../components/data/identify/SwipeHeader')
    }
};

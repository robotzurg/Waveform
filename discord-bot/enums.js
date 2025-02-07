// This file contains various enum structures to use in other files
// They're setup like objects because it's convenient and easy to work with.
// Perhaps if I switched to typescript these could be proper enums lol

// SpecRating means "Specific Rating"
const DatabaseQuery = {
    // User Queries
    UserAllAlbums: "user_all_albums",
    UserAllEPs: "user_all_eps",
    UserAllSongs: "user_all_songs",
    UserAllRemixes: "user_all_remixes",
    UserSpecRatingAlbums: "user_spec_rating_albums",
    UserSpecRatingEPs: "user_spec_rating_eps",
    UserSpecRatingSongs: "user_spec_rating_songs",
    UserSpecRatingRemixes: "user_spec_rating_remixes",
    UserFavoriteList: "user_favorite_list",

    // Server Queries
    ServerAllAlbums: "server_all_albums",
    ServerAllEPs: "server_all_eps",
    ServerAllSongs: "server_all_songs",
    ServerAllRemixes: "server_all_remixes",
    ServerSpecRatingAlbums: "server_spec_rating_albums",
    ServerSpecRatingEPs: "server_spec_rating_eps",
    ServerSpecRatingSongs: "server_spec_rating_songs",
    ServerSpecRatingRemixes: "server_spec_rating_remixes",
    ServerFavoriteList: "server_favorite_list",

    // Global Queries
    GlobalAllAlbums: "global_all_albums",
    GlobalAllEPs: "global_all_eps",
    GlobalAllSongs: "global_all_songs",
    GlobalAllRemixes: "global_all_remixes",
    GlobalSpecRatingAlbums: "global_spec_rating_albums",
    GlobalSpecRatingEPs: "global_spec_rating_eps",
    GlobalSpecRatingSongs: "global_spec_rating_songs",
    GlobalSpecRatingRemixes: "global_spec_rating_remixes",
    GlobalFavoriteList: "global_favorite_list",

};

export default { DatabaseQuery };
MicroMacroApp.config(function($stateProvider){

    $stateProvider.state('workspace',{
        name: 'workspace',
        url: '/workspace/{workspaceId}',
        component:'workspace',
        resolve: {
            workspace: function(Workspaces, $stateParams) {
                return Workspaces.load($stateParams.workspaceId);
            }
        }
    });

    $stateProvider.state('workspace.newQuery', {
        url: '/new-query/{type}',
        resolve: {
            query: function($stateParams) {
                return {type:$stateParams.type};
            },
            tables: function(Tables) {
                return Tables.list();
            }
        },
        views : {
            config : {
                component:'queryConfig'
            }
        }
    });

    $stateProvider.state('workspace.query', {
        url: '/query/{queryId}?{ver:int}',
        params : {
            ver : 0
        },
        resolve: {
            query: function(Queries, $stateParams) {
                return Queries.load($stateParams.workspaceId, $stateParams.queryId, $stateParams.ver);
            },
            tables: function(Tables) {
                return Tables.list();
            },
            keys: function(query, Tables) {
                return Tables.schema(query.table);
            },
            notes : function(Queries, $stateParams) {
                return Queries.getMeta($stateParams.workspaceId, $stateParams.queryId, "notes"/*, "json", []*/);
            }
        },
        views : {
            config : {
                component:'queryConfig'
            },
            queryNotes : {
                component:'queryNotes'
            }
        }
    });

    $stateProvider.state('workspace.query.execute', {
        url: '/execute/{page:int}?{displayKeys:json}',
        params : {
            page : {dynamic:true},
            displayKeys : {dynamic:true}
        },
        views: {
            'result@workspace' : {
                component:'queryResult'
            }
        },
        resolve: {
            result: function(query, Queries) {
                return Queries.execute(query);
            },
            defaultKeys : function(Queries, $stateParams) {
                return Queries.getKeys($stateParams.workspaceId, $stateParams.queryId);
            }
        }
    });


});
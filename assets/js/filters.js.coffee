"use strict"

angular.module("walletFilters", [])
      
.filter "btc", ->
  (input) ->
    if input && !isNaN(input) 
     numeral(input).divide(100000000).format("0.[00000000]") + " BTC"
    else
      ""
#
# .filter "currentRequests", ->
#   (items) ->
#     console.log "Items:"
#     console.log items
#     return items.filter((item) ->
#       return item.complete == false && !item.canceled
#     )

.filter "getByProperty", ->
  (propertyName, propertyValue, collection) ->
    i = 0
    len = collection.length
    while i < len
      return collection[i]  if collection[i][propertyName] == propertyValue
      i++
    null

.filter "getByPropertyNested", ->
  (propertyName, propertyValue, collection) ->
    i = 0
    len = collection.length
    while i < len
      subCollection = collection[i][propertyName]
      j = 0
      len2 = subCollection.length 
      while j < len2
        return collection[i]  if collection[i][propertyName][j] == propertyValue
        j++
      i++
    null